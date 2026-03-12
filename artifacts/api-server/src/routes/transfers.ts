import { Router } from "express";
import { db, transfersTable, invoicesTable, invoiceItemsTable, productsTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { logHistory } from "./history.js";
import { getInvoiceWithItems } from "./invoices.js";

const router = Router();

router.get("/", async (req, res) => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;

  const fromInvoices = db.$with("from_inv").as(
    db.select({ id: invoicesTable.id, invoiceNo: invoicesTable.invoiceNo, customerName: invoicesTable.customerName })
      .from(invoicesTable)
  );

  // Simple join approach
  const allTransfers = await db
    .select({
      id: transfersTable.id,
      productId: transfersTable.productId,
      productName: productsTable.name,
      qty: transfersTable.qty,
      fromInvoiceId: transfersTable.fromInvoiceId,
      toInvoiceId: transfersTable.toInvoiceId,
      date: transfersTable.date,
      note: transfersTable.note,
    })
    .from(transfersTable)
    .leftJoin(productsTable, eq(transfersTable.productId, productsTable.id))
    .orderBy(desc(transfersTable.date));

  // Fetch invoice data separately for from/to
  const result = await Promise.all(allTransfers.map(async (t) => {
    const [fromInv] = await db.select({ invoiceNo: invoicesTable.invoiceNo, customerName: invoicesTable.customerName }).from(invoicesTable).where(eq(invoicesTable.id, t.fromInvoiceId));
    const [toInv] = await db.select({ invoiceNo: invoicesTable.invoiceNo, customerName: invoicesTable.customerName }).from(invoicesTable).where(eq(invoicesTable.id, t.toInvoiceId));
    return {
      id: t.id,
      productId: t.productId,
      productName: t.productName || "",
      qty: parseFloat(t.qty as any),
      fromInvoiceId: t.fromInvoiceId,
      fromInvoiceNo: fromInv?.invoiceNo || "",
      fromCustomer: fromInv?.customerName || "",
      toInvoiceId: t.toInvoiceId,
      toInvoiceNo: toInv?.invoiceNo || "",
      toCustomer: toInv?.customerName || "",
      date: t.date,
      note: t.note || null,
    };
  }));

  // Date filter
  const filtered = result.filter(t => {
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    return true;
  });

  res.json(filtered);
});

router.post("/", async (req, res) => {
  const { fromInvoiceId, toInvoiceId, toCustomerName, productId, qty, note } = req.body;
  if (!fromInvoiceId || !productId || !qty) return res.status(400).json({ error: "fromInvoiceId, productId, qty required" });

  const today = new Date().toISOString().split("T")[0];

  // Find the item in the from invoice
  const [fromItem] = await db
    .select({ id: invoiceItemsTable.id, qty: invoiceItemsTable.qty, price: invoiceItemsTable.price })
    .from(invoiceItemsTable)
    .where(and(eq(invoiceItemsTable.invoiceId, fromInvoiceId), eq(invoiceItemsTable.productId, productId)));

  if (!fromItem) return res.status(400).json({ error: "Product not found in source invoice" });

  const currentQty = parseFloat(fromItem.qty as any);
  if (qty > currentQty) return res.status(400).json({ error: "Transfer qty exceeds available qty" });

  const price = parseFloat(fromItem.price as any);
  const newFromQty = currentQty - qty;

  // Update or remove from source
  if (newFromQty <= 0) {
    await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.id, fromItem.id));
  } else {
    await db.update(invoiceItemsTable).set({
      qty: String(newFromQty),
      subtotal: String(newFromQty * price),
    }).where(eq(invoiceItemsTable.id, fromItem.id));
  }

  // Recalculate from invoice total
  const fromItems = await db.select({ subtotal: invoiceItemsTable.subtotal }).from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, fromInvoiceId));
  const fromTotal = fromItems.reduce((s, i) => s + parseFloat(i.subtotal as any), 0);
  await db.update(invoicesTable).set({ total: String(fromTotal) }).where(eq(invoicesTable.id, fromInvoiceId));

  // Determine target invoice
  let targetInvoiceId: number;
  if (toInvoiceId) {
    targetInvoiceId = toInvoiceId;
    // Add to existing invoice
    const [existingItem] = await db
      .select({ id: invoiceItemsTable.id, qty: invoiceItemsTable.qty })
      .from(invoiceItemsTable)
      .where(and(eq(invoiceItemsTable.invoiceId, toInvoiceId), eq(invoiceItemsTable.productId, productId)));

    if (existingItem) {
      const newQty = parseFloat(existingItem.qty as any) + qty;
      await db.update(invoiceItemsTable).set({
        qty: String(newQty),
        subtotal: String(newQty * price),
      }).where(eq(invoiceItemsTable.id, existingItem.id));
    } else {
      await db.insert(invoiceItemsTable).values({
        invoiceId: toInvoiceId,
        productId,
        qty: String(qty),
        price: String(price),
        subtotal: String(qty * price),
      });
    }
  } else if (toCustomerName) {
    // Create new invoice
    const lastInv = await db.select({ invoiceNo: invoicesTable.invoiceNo }).from(invoicesTable).orderBy(desc(invoicesTable.id)).limit(1);
    const num = lastInv.length ? parseInt(lastInv[0].invoiceNo.replace("INV-", "")) + 1 : 1;
    const invoiceNo = `INV-${String(num).padStart(3, "0")}`;
    const [newInv] = await db.insert(invoicesTable).values({
      invoiceNo,
      customerName: toCustomerName,
      date: today,
      total: String(qty * price),
      deliveryId: null,
      note: note || null,
    }).returning();
    await db.insert(invoiceItemsTable).values({
      invoiceId: newInv.id,
      productId,
      qty: String(qty),
      price: String(price),
      subtotal: String(qty * price),
    });
    targetInvoiceId = newInv.id;
  } else {
    return res.status(400).json({ error: "Must provide toInvoiceId or toCustomerName" });
  }

  // Recalculate to invoice total
  const toItems = await db.select({ subtotal: invoiceItemsTable.subtotal }).from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, targetInvoiceId));
  const toTotal = toItems.reduce((s, i) => s + parseFloat(i.subtotal as any), 0);
  await db.update(invoicesTable).set({ total: String(toTotal) }).where(eq(invoicesTable.id, targetInvoiceId));

  // Record transfer (note: stock does NOT change during transfer)
  const [transfer] = await db.insert(transfersTable).values({
    productId,
    qty: String(qty),
    fromInvoiceId,
    toInvoiceId: targetInvoiceId,
    date: today,
    note: note || null,
  }).returning();

  const [product] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, productId));
  const [fromInvData] = await db.select({ invoiceNo: invoicesTable.invoiceNo, customerName: invoicesTable.customerName }).from(invoicesTable).where(eq(invoicesTable.id, fromInvoiceId));
  const [toInvData] = await db.select({ invoiceNo: invoicesTable.invoiceNo, customerName: invoicesTable.customerName }).from(invoicesTable).where(eq(invoicesTable.id, targetInvoiceId));

  await logHistory("TRANSFER", "invoice_item", transfer.id, `Transferred ${qty} x ${product?.name} from ${fromInvData?.customerName} to ${toInvData?.customerName}`);

  const updatedFrom = await getInvoiceWithItems(fromInvoiceId);
  const updatedTo = await getInvoiceWithItems(targetInvoiceId);

  res.status(201).json({
    transfer: {
      id: transfer.id,
      productId: transfer.productId,
      productName: product?.name || "",
      qty,
      fromInvoiceId,
      fromInvoiceNo: fromInvData?.invoiceNo || "",
      fromCustomer: fromInvData?.customerName || "",
      toInvoiceId: targetInvoiceId,
      toInvoiceNo: toInvData?.invoiceNo || "",
      toCustomer: toInvData?.customerName || "",
      date: transfer.date,
      note: transfer.note || null,
    },
    updatedFromInvoice: updatedFrom,
    newOrUpdatedToInvoice: updatedTo,
  });
});

export default router;
