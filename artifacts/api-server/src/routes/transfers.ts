import { Router } from "express";
import { db, transfersTable, invoicesTable, invoiceItemsTable, productsTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { logHistory } from "./history.js";
import { getInvoiceWithItems } from "./invoices.js";

const router = Router();

// ── Helper: recalculate & save invoice total ──────────────────────────────────
async function recalcInvoiceTotal(invoiceId: number) {
  const items = await db
    .select({ subtotal: invoiceItemsTable.subtotal })
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, invoiceId));
  const total = items.reduce((s, i) => s + parseFloat(i.subtotal as any), 0);
  await db.update(invoicesTable).set({ total: String(total) }).where(eq(invoicesTable.id, invoiceId));
  return total;
}

// ── Helper: append a note line to an invoice ─────────────────────────────────
async function appendInvoiceNote(invoiceId: number, line: string) {
  const [inv] = await db.select({ note: invoicesTable.note }).from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  const existing = inv?.note?.trim() || "";
  const updated = existing ? `${existing}\n${line}` : line;
  await db.update(invoicesTable).set({ note: updated }).where(eq(invoicesTable.id, invoiceId));
}

// ── GET /transfers ────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;

  const rows = await db
    .select()
    .from(transfersTable)
    .orderBy(desc(transfersTable.createdAt));

  const filtered = rows.filter(t => {
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    return true;
  });

  res.json(filtered.map(t => ({
    id: t.id,
    date: t.date,
    createdAt: t.createdAt,
    productId: t.productId,
    itemName: t.itemName,
    qty: parseFloat(t.qty as any),
    fromInvoiceId: t.fromInvoiceId,
    fromInvoiceNo: t.fromInvoiceNo,
    fromCustomerName: t.fromCustomerName,
    toInvoiceId: t.toInvoiceId,
    toInvoiceNo: t.toInvoiceNo,
    toCustomerName: t.toCustomerName,
    createdBy: t.createdBy,
    isReversed: t.isReversed,
    reversedAt: t.reversedAt,
    note: t.note,
  })));
});

// ── POST /transfers — execute a transfer ──────────────────────────────────────
router.post("/", async (req, res) => {
  const { fromInvoiceId, toInvoiceId, toCustomerName, productId, qty, note } = req.body;

  if (!fromInvoiceId || !productId || !qty) {
    return res.status(400).json({ error: "fromInvoiceId, productId, qty required" });
  }

  const today = new Date().toISOString().split("T")[0];
  const transferQty = Number(qty);

  // Find the item in the source invoice
  const [fromItem] = await db
    .select({ id: invoiceItemsTable.id, qty: invoiceItemsTable.qty, price: invoiceItemsTable.price })
    .from(invoiceItemsTable)
    .where(and(
      eq(invoiceItemsTable.invoiceId, fromInvoiceId),
      eq(invoiceItemsTable.productId, productId)
    ));

  if (!fromItem) {
    return res.status(400).json({ error: "Product not found in source invoice" });
  }

  const currentQty = parseFloat(fromItem.qty as any);

  // ── VALIDATION ──
  if (currentQty <= 0) {
    return res.status(400).json({ error: "Transfer quantity exceeds available items." });
  }
  if (transferQty > currentQty) {
    return res.status(400).json({ error: "Transfer quantity exceeds available items." });
  }

  const price = parseFloat(fromItem.price as any);
  const newFromQty = currentQty - transferQty;

  // ── Deduct from source ──
  if (newFromQty <= 0) {
    await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.id, fromItem.id));
  } else {
    await db.update(invoiceItemsTable).set({
      qty: String(newFromQty),
      subtotal: String(newFromQty * price),
    }).where(eq(invoiceItemsTable.id, fromItem.id));
  }
  await recalcInvoiceTotal(fromInvoiceId);

  // ── Determine target invoice ──
  let targetInvoiceId: number;

  if (toInvoiceId) {
    targetInvoiceId = toInvoiceId;
    const [existingItem] = await db
      .select({ id: invoiceItemsTable.id, qty: invoiceItemsTable.qty })
      .from(invoiceItemsTable)
      .where(and(
        eq(invoiceItemsTable.invoiceId, toInvoiceId),
        eq(invoiceItemsTable.productId, productId)
      ));

    if (existingItem) {
      const newQty = parseFloat(existingItem.qty as any) + transferQty;
      await db.update(invoiceItemsTable).set({
        qty: String(newQty),
        subtotal: String(newQty * price),
      }).where(eq(invoiceItemsTable.id, existingItem.id));
    } else {
      await db.insert(invoiceItemsTable).values({
        invoiceId: toInvoiceId,
        productId,
        qty: String(transferQty),
        price: String(price),
        subtotal: String(transferQty * price),
      });
    }
  } else if (toCustomerName) {
    const lastInv = await db
      .select({ invoiceNo: invoicesTable.invoiceNo })
      .from(invoicesTable)
      .orderBy(desc(invoicesTable.id))
      .limit(1);
    const num = lastInv.length ? parseInt(lastInv[0].invoiceNo.replace("INV-", "")) + 1 : 1;
    const invoiceNo = `INV-${String(num).padStart(3, "0")}`;
    const [newInv] = await db.insert(invoicesTable).values({
      invoiceNo,
      customerName: toCustomerName,
      date: today,
      total: String(transferQty * price),
      deliveryId: null,
      note: null,
    }).returning();
    await db.insert(invoiceItemsTable).values({
      invoiceId: newInv.id,
      productId,
      qty: String(transferQty),
      price: String(price),
      subtotal: String(transferQty * price),
    });
    targetInvoiceId = newInv.id;
  } else {
    return res.status(400).json({ error: "Must provide toInvoiceId or toCustomerName" });
  }

  await recalcInvoiceTotal(targetInvoiceId);

  // ── Fetch names for notes and record ──
  const [product] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, productId));
  const [fromInvData] = await db.select({ invoiceNo: invoicesTable.invoiceNo, customerName: invoicesTable.customerName }).from(invoicesTable).where(eq(invoicesTable.id, fromInvoiceId));
  const [toInvData] = await db.select({ invoiceNo: invoicesTable.invoiceNo, customerName: invoicesTable.customerName }).from(invoicesTable).where(eq(invoicesTable.id, targetInvoiceId));

  const itemName = product?.name || `Product #${productId}`;
  const fromNo = fromInvData?.invoiceNo || "";
  const fromCust = fromInvData?.customerName || "";
  const toNo = toInvData?.invoiceNo || "";
  const toCust = toInvData?.customerName || "";

  // ── Update invoice notes ──
  await appendInvoiceNote(fromInvoiceId, `Transferred ${transferQty} ${itemName} to ${toNo} (${toCust})`);
  await appendInvoiceNote(targetInvoiceId, `Received ${transferQty} ${itemName} from ${fromNo} (${fromCust})`);

  // ── Record the transfer ──
  const [transfer] = await db.insert(transfersTable).values({
    productId,
    qty: String(transferQty),
    fromInvoiceId,
    toInvoiceId: targetInvoiceId,
    fromInvoiceNo: fromNo,
    fromCustomerName: fromCust,
    toInvoiceNo: toNo,
    toCustomerName: toCust,
    itemName,
    createdBy: "Admin",
    date: today,
    note: note || null,
  }).returning();

  await logHistory("TRANSFER", "invoice_item", transfer.id, `Transferred ${transferQty} × ${itemName} from ${fromNo} (${fromCust}) to ${toNo} (${toCust})`);

  const updatedFrom = await getInvoiceWithItems(fromInvoiceId);
  const updatedTo = await getInvoiceWithItems(targetInvoiceId);

  res.status(201).json({
    transfer: {
      id: transfer.id,
      date: transfer.date,
      createdAt: transfer.createdAt,
      productId: transfer.productId,
      itemName,
      qty: transferQty,
      fromInvoiceId,
      fromInvoiceNo: fromNo,
      fromCustomerName: fromCust,
      toInvoiceId: targetInvoiceId,
      toInvoiceNo: toNo,
      toCustomerName: toCust,
      createdBy: "Admin",
      isReversed: false,
      reversedAt: null,
      note: transfer.note,
    },
    updatedFromInvoice: updatedFrom,
    newOrUpdatedToInvoice: updatedTo,
  });
});

// ── POST /transfers/:id/undo — reverse a transfer ─────────────────────────────
router.post("/:id/undo", async (req, res) => {
  const id = parseInt(req.params.id);
  const [transfer] = await db.select().from(transfersTable).where(eq(transfersTable.id, id));

  if (!transfer) return res.status(404).json({ error: "Transfer not found" });
  if (transfer.isReversed) return res.status(400).json({ error: "Transfer already reversed" });

  const qty = parseFloat(transfer.qty as any);
  const price = await getItemPrice(transfer.fromInvoiceId, transfer.productId, transfer.toInvoiceId);

  // ── Add qty back to source invoice ──
  const [srcItem] = await db
    .select({ id: invoiceItemsTable.id, qty: invoiceItemsTable.qty })
    .from(invoiceItemsTable)
    .where(and(
      eq(invoiceItemsTable.invoiceId, transfer.fromInvoiceId),
      eq(invoiceItemsTable.productId, transfer.productId)
    ));

  if (srcItem) {
    const newQty = parseFloat(srcItem.qty as any) + qty;
    await db.update(invoiceItemsTable).set({
      qty: String(newQty),
      subtotal: String(newQty * price),
    }).where(eq(invoiceItemsTable.id, srcItem.id));
  } else {
    await db.insert(invoiceItemsTable).values({
      invoiceId: transfer.fromInvoiceId,
      productId: transfer.productId,
      qty: String(qty),
      price: String(price),
      subtotal: String(qty * price),
    });
  }
  await recalcInvoiceTotal(transfer.fromInvoiceId);

  // ── Remove qty from destination invoice ──
  const [dstItem] = await db
    .select({ id: invoiceItemsTable.id, qty: invoiceItemsTable.qty })
    .from(invoiceItemsTable)
    .where(and(
      eq(invoiceItemsTable.invoiceId, transfer.toInvoiceId),
      eq(invoiceItemsTable.productId, transfer.productId)
    ));

  if (dstItem) {
    const newQty = parseFloat(dstItem.qty as any) - qty;
    if (newQty <= 0) {
      await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.id, dstItem.id));
    } else {
      await db.update(invoiceItemsTable).set({
        qty: String(newQty),
        subtotal: String(newQty * price),
      }).where(eq(invoiceItemsTable.id, dstItem.id));
    }
  }
  await recalcInvoiceTotal(transfer.toInvoiceId);

  // ── Append reversal notes to both invoices ──
  await appendInvoiceNote(transfer.fromInvoiceId, `Transfer reversed — ${qty} ${transfer.itemName} returned from ${transfer.toInvoiceNo} (${transfer.toCustomerName})`);
  await appendInvoiceNote(transfer.toInvoiceId, `Transfer reversed — ${qty} ${transfer.itemName} removed (returned to ${transfer.fromInvoiceNo})`);

  // ── Mark transfer as reversed ──
  const [updated] = await db
    .update(transfersTable)
    .set({ isReversed: true, reversedAt: new Date() })
    .where(eq(transfersTable.id, id))
    .returning();

  await logHistory("UPDATE", "invoice_item", id, `Reversed transfer #${id}: ${qty} × ${transfer.itemName}`);

  res.json({ ...updated, qty: parseFloat(updated.qty as any) });
});

// ── Helper: get price of an item (from destination or source) ─────────────────
async function getItemPrice(fromInvoiceId: number, productId: number, toInvoiceId: number): Promise<number> {
  const [dstItem] = await db
    .select({ price: invoiceItemsTable.price })
    .from(invoiceItemsTable)
    .where(and(eq(invoiceItemsTable.invoiceId, toInvoiceId), eq(invoiceItemsTable.productId, productId)));
  if (dstItem) return parseFloat(dstItem.price as any);

  const [srcItem] = await db
    .select({ price: invoiceItemsTable.price })
    .from(invoiceItemsTable)
    .where(and(eq(invoiceItemsTable.invoiceId, fromInvoiceId), eq(invoiceItemsTable.productId, productId)));
  if (srcItem) return parseFloat(srcItem.price as any);

  return 0;
}

export default router;
