import { Router } from "express";
import { db, invoicesTable, invoiceItemsTable, productsTable, deliveriesTable } from "@workspace/db";
import { eq, and, gte, lte, ilike, desc } from "drizzle-orm";
import { logHistory } from "./history.js";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Compute invoice status from current item qtys. */
function computeInvoiceStatus(items: Array<{ qty: number }>, existingStatus?: string): string {
  if (!items.length) return existingStatus || "Completed";
  const allZero = items.every(i => i.qty <= 0);
  const someZero = items.some(i => i.qty <= 0);
  if (allZero) return "Fully Damaged";
  if (someZero) return "Partially Damaged";
  // If all qtys are positive, only downgrade from damaged status if explicitly reset
  if (existingStatus === "Partially Damaged" || existingStatus === "Fully Damaged") return "Partially Damaged";
  return "Completed";
}

async function getInvoiceWithItems(id: number) {
  const [invoice] = await db
    .select({
      id: invoicesTable.id,
      invoiceNo: invoicesTable.invoiceNo,
      customerName: invoicesTable.customerName,
      date: invoicesTable.date,
      createdAt: invoicesTable.createdAt,
      total: invoicesTable.total,
      deliveryId: invoicesTable.deliveryId,
      deliveryNo: deliveriesTable.deliveryNo,
      note: invoicesTable.note,
      status: invoicesTable.status,
    })
    .from(invoicesTable)
    .leftJoin(deliveriesTable, eq(invoicesTable.deliveryId, deliveriesTable.id))
    .where(eq(invoicesTable.id, id));

  if (!invoice) return null;

  const items = await db
    .select({
      id: invoiceItemsTable.id,
      invoiceId: invoiceItemsTable.invoiceId,
      productId: invoiceItemsTable.productId,
      productName: productsTable.name,
      qty: invoiceItemsTable.qty,
      price: invoiceItemsTable.price,
      subtotal: invoiceItemsTable.subtotal,
    })
    .from(invoiceItemsTable)
    .leftJoin(productsTable, eq(invoiceItemsTable.productId, productsTable.id))
    .where(eq(invoiceItemsTable.invoiceId, id));

  return {
    ...invoice,
    total: parseFloat(invoice.total as any),
    createdAt: invoice.createdAt ? invoice.createdAt.toISOString() : null,
    deliveryId: invoice.deliveryId,
    deliveryNo: invoice.deliveryNo || null,
    note: invoice.note || null,
    status: invoice.status || "Completed",
    items: items.map(i => ({
      id: i.id,
      invoiceId: i.invoiceId,
      productId: i.productId,
      productName: i.productName || "",
      qty: parseFloat(i.qty as any),
      price: parseFloat(i.price as any),
      subtotal: parseFloat(i.subtotal as any),
      isDamaged: false,
    })),
  };
}

async function nextInvoiceNo() {
  const result = await db
    .select({ invoiceNo: invoicesTable.invoiceNo })
    .from(invoicesTable)
    .orderBy(desc(invoicesTable.id))
    .limit(1);
  if (!result.length) return "INV-001";
  const last = result[0].invoiceNo;
  const num = parseInt(last.replace("INV-", "")) + 1;
  return `INV-${String(num).padStart(3, "0")}`;
}

/** Decrease stock for each item in the list (only when trackStock = true). */
async function decreaseStock(tx: typeof db, items: Array<{ productId: number; qty: number }>) {
  for (const item of items) {
    const [product] = await tx
      .select({ trackStock: productsTable.trackStock, stockQty: productsTable.stockQty })
      .from(productsTable)
      .where(eq(productsTable.id, item.productId));

    if (product?.trackStock) {
      const newQty = Math.max(0, product.stockQty - parseFloat(String(item.qty)));
      await tx
        .update(productsTable)
        .set({ stockQty: newQty })
        .where(eq(productsTable.id, item.productId));
    }
  }
}

/** Restore (add back) stock for each item in the list (only when trackStock = true). */
async function restoreStock(tx: typeof db, items: Array<{ productId: number; qty: string | number }>) {
  for (const item of items) {
    const [product] = await tx
      .select({ trackStock: productsTable.trackStock, stockQty: productsTable.stockQty })
      .from(productsTable)
      .where(eq(productsTable.id, item.productId));

    if (product?.trackStock) {
      await tx
        .update(productsTable)
        .set({ stockQty: product.stockQty + parseFloat(String(item.qty)) })
        .where(eq(productsTable.id, item.productId));
    }
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/last-price", async (req, res) => {
  const { customerName, productId } = req.query as Record<string, string>;
  if (!customerName || !productId) return res.status(400).json({ error: "customerName and productId required" });

  const lastSale = await db
    .select({ price: invoiceItemsTable.price, date: invoicesTable.date })
    .from(invoiceItemsTable)
    .innerJoin(invoicesTable, eq(invoiceItemsTable.invoiceId, invoicesTable.id))
    .where(and(eq(invoicesTable.customerName, customerName), eq(invoiceItemsTable.productId, parseInt(productId))))
    .orderBy(desc(invoicesTable.date))
    .limit(1);

  if (!lastSale.length) {
    const [product] = await db.select({ basePrice: productsTable.basePrice }).from(productsTable).where(eq(productsTable.id, parseInt(productId)));
    return res.json({ price: parseFloat(product?.basePrice || "0"), date: null, hasHistory: false });
  }

  res.json({ price: parseFloat(lastSale[0].price as any), date: lastSale[0].date, hasHistory: true });
});

router.get("/", async (req, res) => {
  const { search, dateFrom, dateTo, deliveryId } = req.query as Record<string, string>;

  const conditions = [];
  if (search) conditions.push(ilike(invoicesTable.customerName, `%${search}%`));
  if (dateFrom) conditions.push(gte(invoicesTable.date, dateFrom));
  if (dateTo) conditions.push(lte(invoicesTable.date, dateTo));
  if (deliveryId) conditions.push(eq(invoicesTable.deliveryId, parseInt(deliveryId)));

  const invoices = await db
    .select({
      id: invoicesTable.id,
      invoiceNo: invoicesTable.invoiceNo,
      customerName: invoicesTable.customerName,
      date: invoicesTable.date,
      createdAt: invoicesTable.createdAt,
      total: invoicesTable.total,
      deliveryId: invoicesTable.deliveryId,
      deliveryNo: deliveriesTable.deliveryNo,
      note: invoicesTable.note,
      status: invoicesTable.status,
    })
    .from(invoicesTable)
    .leftJoin(deliveriesTable, eq(invoicesTable.deliveryId, deliveriesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(invoicesTable.date), desc(invoicesTable.id));

  res.json(invoices.map(i => ({
    ...i,
    total: parseFloat(i.total as any),
    createdAt: i.createdAt ? i.createdAt.toISOString() : null,
    deliveryNo: i.deliveryNo || null,
    note: i.note || null,
    status: i.status || "Completed",
  })));
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const inv = await getInvoiceWithItems(id);
  if (!inv) return res.status(404).json({ error: "Not found" });
  res.json(inv);
});

// ── CREATE ────────────────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  const { customerName, date, deliveryId, note, items } = req.body;
  if (!customerName || !date || !items?.length) {
    return res.status(400).json({ error: "customerName, date, and items required" });
  }

  const invoiceNo = await nextInvoiceNo();
  const total = items.reduce((sum: number, item: any) => sum + item.qty * item.price, 0);

  let invoiceId: number;

  // --- Transaction: insert invoice + items, then update stock ---
  await db.transaction(async (tx) => {
    const [invoice] = await tx
      .insert(invoicesTable)
      .values({ invoiceNo, customerName, date, total: String(total), deliveryId: deliveryId || null, note: note || null, status: "Completed" })
      .returning();

    invoiceId = invoice.id;

    // 1. Insert all items first
    for (const item of items) {
      const subtotal = item.qty * item.price;
      await tx.insert(invoiceItemsTable).values({
        invoiceId: invoice.id,
        productId: item.productId,
        qty: String(item.qty),
        price: String(item.price),
        subtotal: String(subtotal),
      });
    }

    // 2. Only after all items are saved, reduce stock
    await decreaseStock(tx, items);
  });

  await logHistory("CREATE", "invoice", invoiceId!, `Created invoice ${invoiceNo} for ${customerName}`);
  const full = await getInvoiceWithItems(invoiceId!);
  res.status(201).json(full);
});

// ── UPDATE ────────────────────────────────────────────────────────────────────

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { customerName, date, deliveryId, note, items } = req.body;

  await db.transaction(async (tx) => {
    // 1. Fetch old items to restore their stock
    const oldItems = await tx
      .select({ productId: invoiceItemsTable.productId, qty: invoiceItemsTable.qty })
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, id));

    // 2. Restore stock for old items
    await restoreStock(tx, oldItems);

    // 3. Fetch current status before updating
    const [currentInv] = await tx.select({ status: invoicesTable.status }).from(invoicesTable).where(eq(invoicesTable.id, id));
    const currentStatus = currentInv?.status || "Completed";

    // 4. Compute new status based on new items
    const newItems = (items || []) as Array<{ qty: number }>;
    const newStatus = computeInvoiceStatus(newItems, currentStatus);

    // 5. Update invoice header
    const total = newItems.reduce((sum: number, item: any) => sum + item.qty * item.price, 0);
    await tx
      .update(invoicesTable)
      .set({ customerName, date, total: String(total), deliveryId: deliveryId || null, note: note || null, status: newStatus })
      .where(eq(invoicesTable.id, id));

    // 6. Replace all items
    await tx.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
    for (const item of (items || [])) {
      const subtotal = item.qty * item.price;
      await tx.insert(invoiceItemsTable).values({
        invoiceId: id,
        productId: item.productId,
        qty: String(item.qty),
        price: String(item.price),
        subtotal: String(subtotal),
      });
    }

    // 7. Only after all items are saved, reduce stock for new items
    await decreaseStock(tx, items || []);
  });

  await logHistory("UPDATE", "invoice", id, `Updated invoice id: ${id}`);
  const full = await getInvoiceWithItems(id);
  res.json(full);
});

// ── DELETE ────────────────────────────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  await db.transaction(async (tx) => {
    const [inv] = await tx.select({ invoiceNo: invoicesTable.invoiceNo }).from(invoicesTable).where(eq(invoicesTable.id, id));

    const oldItems = await tx
      .select({ productId: invoiceItemsTable.productId, qty: invoiceItemsTable.qty })
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, id));

    // Restore stock before deleting
    await restoreStock(tx, oldItems);

    await tx.delete(invoicesTable).where(eq(invoicesTable.id, id));
    await logHistory("DELETE", "invoice", id, `Deleted invoice ${inv?.invoiceNo || id}`);
  });

  res.status(204).end();
});

// ── DUPLICATE ─────────────────────────────────────────────────────────────────

router.post("/:id/duplicate", async (req, res) => {
  const id = parseInt(req.params.id);
  const original = await getInvoiceWithItems(id);
  if (!original) return res.status(404).json({ error: "Not found" });

  const invoiceNo = await nextInvoiceNo();
  const today = new Date().toISOString().split("T")[0];

  let newInvoiceId: number;

  await db.transaction(async (tx) => {
    const [newInvoice] = await tx
      .insert(invoicesTable)
      .values({ invoiceNo, customerName: original.customerName, date: today, total: String(original.total), deliveryId: null, note: original.note })
      .returning();

    newInvoiceId = newInvoice.id;

    for (const item of original.items) {
      await tx.insert(invoiceItemsTable).values({
        invoiceId: newInvoice.id,
        productId: item.productId,
        qty: String(item.qty),
        price: String(item.price),
        subtotal: String(item.subtotal),
      });
    }

    // Reduce stock for the duplicated items
    await decreaseStock(tx, original.items);
  });

  await logHistory("CREATE", "invoice", newInvoiceId!, `Duplicated invoice ${original.invoiceNo} → ${invoiceNo}`);
  const full = await getInvoiceWithItems(newInvoiceId!);
  res.status(201).json(full);
});

// ── GET /api/invoices/:id/packing ──────────────────────────────────────────
router.get("/:id/packing", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const [row] = await db
    .select({ packingGroups: invoicesTable.packingGroups })
    .from(invoicesTable)
    .where(eq(invoicesTable.id, id));

  if (!row) return res.status(404).json({ error: "Not found" });

  let groups: unknown[] = [];
  try { groups = row.packingGroups ? JSON.parse(row.packingGroups) : []; } catch {}
  res.json({ groups });
});

// ── PUT /api/invoices/:id/packing ──────────────────────────────────────────
router.put("/:id/packing", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const { groups } = req.body;
  if (!Array.isArray(groups)) return res.status(400).json({ error: "groups must be an array" });

  const [row] = await db
    .update(invoicesTable)
    .set({ packingGroups: JSON.stringify(groups) })
    .where(eq(invoicesTable.id, id))
    .returning({ id: invoicesTable.id });

  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

// ── POST /api/invoices/:id/damage-item ────────────────────────────────────
// Records damage for one invoice item: reduces its qty, appends note, creates damage record.
router.post("/:id/damage-item", async (req, res) => {
  const invoiceId = parseInt(req.params.id);
  if (isNaN(invoiceId)) return res.status(400).json({ error: "Invalid invoice ID" });

  const { invoiceItemId, damageQty, damageReason } = req.body;
  if (!invoiceItemId || !damageQty || damageQty <= 0)
    return res.status(400).json({ error: "invoiceItemId and damageQty required" });

  const [invItem] = await db
    .select({
      id:        invoiceItemsTable.id,
      invoiceId: invoiceItemsTable.invoiceId,
      productId: invoiceItemsTable.productId,
      qty:       invoiceItemsTable.qty,
      price:     invoiceItemsTable.price,
      productName: productsTable.name,
    })
    .from(invoiceItemsTable)
    .leftJoin(productsTable, eq(invoiceItemsTable.productId, productsTable.id))
    .where(eq(invoiceItemsTable.id, invoiceItemId));

  if (!invItem || invItem.invoiceId !== invoiceId)
    return res.status(404).json({ error: "Invoice item not found" });

  const currentQty = parseFloat(invItem.qty as any);
  if (damageQty > currentQty)
    return res.status(400).json({ error: `Damage qty (${damageQty}) exceeds item qty (${currentQty})` });

  const newQty     = currentQty - damageQty;
  const newSubtotal = newQty * parseFloat(invItem.price as any);

  await db.update(invoiceItemsTable).set({
    qty:      newQty.toString(),
    subtotal: newSubtotal.toString(),
  }).where(eq(invoiceItemsTable.id, invoiceItemId));

  // Recalculate invoice total
  const allItems = await db.select({ subtotal: invoiceItemsTable.subtotal })
    .from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, invoiceId));
  const newTotal = allItems.reduce((s, i) => s + parseFloat(i.subtotal as any), 0);
  await db.update(invoicesTable).set({ total: newTotal.toString() }).where(eq(invoicesTable.id, invoiceId));

  // Append note + update invoice status
  const [inv] = await db.select({ note: invoicesTable.note, invoiceNo: invoicesTable.invoiceNo, customerName: invoicesTable.customerName })
    .from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  const noteAppend = `${damageQty} ${invItem.productName || "item"} damaged and removed from invoice`;
  const existingNote = inv.note || "";
  const newNote = existingNote ? `${existingNote}; ${noteAppend}` : noteAppend;

  // Recompute invoice status from all current item qtys
  const itemsForStatus = await db.select({ qty: invoiceItemsTable.qty }).from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, invoiceId));
  const parsedItems = itemsForStatus.map(i => ({ qty: parseFloat(i.qty as any) }));
  const newStatus = computeInvoiceStatus(parsedItems, "Partially Damaged");

  await db.update(invoicesTable).set({ note: newNote, status: newStatus }).where(eq(invoicesTable.id, invoiceId));

  // Create damage record
  const { damageRecordsTable } = await import("@workspace/db");
  await db.insert(damageRecordsTable).values({
    itemName:      invItem.productName || "Unknown",
    productId:     invItem.productId,
    damageQty:     damageQty.toString(),
    repairedQty:   "0",
    soldQty:       "0",
    remainingQty:  damageQty.toString(),
    invoiceNumber: inv.invoiceNo,
    customerName:  inv.customerName,
    damageDate:    new Date().toISOString().split("T")[0],
    damageReason:  damageReason || null,
    status:        "Damaged",
  });

  await logHistory("UPDATE", "invoice", invoiceId, `Damage: ${damageQty} × ${invItem.productName} removed`);

  const updated = await getInvoiceWithItems(invoiceId);
  res.json(updated);
});

export { getInvoiceWithItems };
export default router;
