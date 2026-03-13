import { Router } from "express";
import { db, invoicesTable, invoiceItemsTable, productsTable, deliveriesTable } from "@workspace/db";
import { eq, and, gte, lte, ilike, desc } from "drizzle-orm";
import { logHistory } from "./history.js";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getInvoiceWithItems(id: number) {
  const [invoice] = await db
    .select({
      id: invoicesTable.id,
      invoiceNo: invoicesTable.invoiceNo,
      customerName: invoicesTable.customerName,
      date: invoicesTable.date,
      createdAt: invoicesTable.createdAt,
      total: invoicesTable.total,
      deposit: invoicesTable.deposit,
      deliveryId: invoicesTable.deliveryId,
      deliveryNo: deliveriesTable.deliveryNo,
      note: invoicesTable.note,
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
    deposit: parseFloat(invoice.deposit as any),
    createdAt: invoice.createdAt ? invoice.createdAt.toISOString() : null,
    deliveryId: invoice.deliveryId,
    deliveryNo: invoice.deliveryNo || null,
    note: invoice.note || null,
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
      deposit: invoicesTable.deposit,
      deliveryId: invoicesTable.deliveryId,
      deliveryNo: deliveriesTable.deliveryNo,
      note: invoicesTable.note,
    })
    .from(invoicesTable)
    .leftJoin(deliveriesTable, eq(invoicesTable.deliveryId, deliveriesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(invoicesTable.date), desc(invoicesTable.id));

  res.json(invoices.map(i => ({
    ...i,
    total: parseFloat(i.total as any),
    deposit: parseFloat(i.deposit as any),
    createdAt: i.createdAt ? i.createdAt.toISOString() : null,
    deliveryNo: i.deliveryNo || null,
    note: i.note || null,
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
  const { customerName, date, deliveryId, note, deposit, items } = req.body;
  if (!customerName || !date || !items?.length) {
    return res.status(400).json({ error: "customerName, date, and items required" });
  }

  const invoiceNo = await nextInvoiceNo();
  const total = items.reduce((sum: number, item: any) => sum + item.qty * item.price, 0);
  const depositVal = parseFloat(String(deposit ?? 0)) || 0;

  let invoiceId: number;

  // --- Transaction: insert invoice + items, then update stock ---
  await db.transaction(async (tx) => {
    const [invoice] = await tx
      .insert(invoicesTable)
      .values({ invoiceNo, customerName, date, total: String(total), deposit: String(depositVal), deliveryId: deliveryId || null, note: note || null })
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
  const { customerName, date, deliveryId, note, deposit, items } = req.body;

  await db.transaction(async (tx) => {
    // 1. Fetch old items to restore their stock
    const oldItems = await tx
      .select({ productId: invoiceItemsTable.productId, qty: invoiceItemsTable.qty })
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, id));

    // 2. Restore stock for old items
    await restoreStock(tx, oldItems);

    // 3. Update invoice header
    const total = (items || []).reduce((sum: number, item: any) => sum + item.qty * item.price, 0);
    const depositVal = parseFloat(String(deposit ?? 0)) || 0;
    await tx
      .update(invoicesTable)
      .set({ customerName, date, total: String(total), deposit: String(depositVal), deliveryId: deliveryId || null, note: note || null })
      .where(eq(invoicesTable.id, id));

    // 4. Replace all items
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

    // 5. Only after all items are saved, reduce stock for new items
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
      .values({ invoiceNo, customerName: original.customerName, date: today, total: String(original.total), deposit: String(original.deposit), deliveryId: null, note: original.note })
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

export { getInvoiceWithItems };
export default router;
