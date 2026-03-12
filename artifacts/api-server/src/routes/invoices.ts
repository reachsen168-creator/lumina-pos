import { Router } from "express";
import { db, invoicesTable, invoiceItemsTable, productsTable, deliveriesTable } from "@workspace/db";
import { eq, and, gte, lte, ilike, sql, desc } from "drizzle-orm";
import { logHistory } from "./history.js";

const router = Router();

async function getInvoiceWithItems(id: number) {
  const [invoice] = await db
    .select({
      id: invoicesTable.id,
      invoiceNo: invoicesTable.invoiceNo,
      customerName: invoicesTable.customerName,
      date: invoicesTable.date,
      total: invoicesTable.total,
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

router.get("/last-price", async (req, res) => {
  const { customerName, productId } = req.query as Record<string, string>;
  if (!customerName || !productId) return res.status(400).json({ error: "customerName and productId required" });

  const lastSale = await db
    .select({
      price: invoiceItemsTable.price,
      date: invoicesTable.date,
    })
    .from(invoiceItemsTable)
    .innerJoin(invoicesTable, eq(invoiceItemsTable.invoiceId, invoicesTable.id))
    .where(
      and(
        eq(invoicesTable.customerName, customerName),
        eq(invoiceItemsTable.productId, parseInt(productId))
      )
    )
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
      total: invoicesTable.total,
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

router.post("/", async (req, res) => {
  const { customerName, date, deliveryId, note, items } = req.body;
  if (!customerName || !date || !items?.length) return res.status(400).json({ error: "customerName, date, and items required" });

  const invoiceNo = await nextInvoiceNo();

  // Calculate total
  const total = items.reduce((sum: number, item: any) => sum + item.qty * item.price, 0);

  const [invoice] = await db.insert(invoicesTable).values({
    invoiceNo,
    customerName,
    date,
    total: String(total),
    deliveryId: deliveryId || null,
    note: note || null,
  }).returning();

  // Insert items and update stock
  for (const item of items) {
    const subtotal = item.qty * item.price;
    await db.insert(invoiceItemsTable).values({
      invoiceId: invoice.id,
      productId: item.productId,
      qty: String(item.qty),
      price: String(item.price),
      subtotal: String(subtotal),
    });

    // Decrease stock if tracked
    const [product] = await db.select({ trackStock: productsTable.trackStock, stockQty: productsTable.stockQty }).from(productsTable).where(eq(productsTable.id, item.productId));
    if (product?.trackStock) {
      await db.update(productsTable).set({ stockQty: Math.max(0, product.stockQty - Math.round(item.qty)) }).where(eq(productsTable.id, item.productId));
    }
  }

  await logHistory("CREATE", "invoice", invoice.id, `Created invoice ${invoiceNo} for ${customerName}`);

  const full = await getInvoiceWithItems(invoice.id);
  res.status(201).json(full);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { customerName, date, deliveryId, note, items } = req.body;

  // Get old items to restore stock
  const oldItems = await db
    .select({ productId: invoiceItemsTable.productId, qty: invoiceItemsTable.qty })
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, id));

  // Restore stock for old items
  for (const oldItem of oldItems) {
    const [product] = await db.select({ trackStock: productsTable.trackStock, stockQty: productsTable.stockQty }).from(productsTable).where(eq(productsTable.id, oldItem.productId));
    if (product?.trackStock) {
      await db.update(productsTable).set({ stockQty: product.stockQty + Math.round(parseFloat(oldItem.qty as any)) }).where(eq(productsTable.id, oldItem.productId));
    }
  }

  const total = (items || []).reduce((sum: number, item: any) => sum + item.qty * item.price, 0);

  await db.update(invoicesTable).set({
    customerName,
    date,
    total: String(total),
    deliveryId: deliveryId || null,
    note: note || null,
  }).where(eq(invoicesTable.id, id));

  // Replace items
  await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  for (const item of (items || [])) {
    const subtotal = item.qty * item.price;
    await db.insert(invoiceItemsTable).values({
      invoiceId: id,
      productId: item.productId,
      qty: String(item.qty),
      price: String(item.price),
      subtotal: String(subtotal),
    });
    const [product] = await db.select({ trackStock: productsTable.trackStock, stockQty: productsTable.stockQty }).from(productsTable).where(eq(productsTable.id, item.productId));
    if (product?.trackStock) {
      await db.update(productsTable).set({ stockQty: Math.max(0, product.stockQty - Math.round(item.qty)) }).where(eq(productsTable.id, item.productId));
    }
  }

  await logHistory("UPDATE", "invoice", id, `Updated invoice id: ${id}`);
  const full = await getInvoiceWithItems(id);
  res.json(full);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [inv] = await db.select({ invoiceNo: invoicesTable.invoiceNo }).from(invoicesTable).where(eq(invoicesTable.id, id));

  // Restore stock
  const items = await db.select({ productId: invoiceItemsTable.productId, qty: invoiceItemsTable.qty }).from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  for (const item of items) {
    const [product] = await db.select({ trackStock: productsTable.trackStock, stockQty: productsTable.stockQty }).from(productsTable).where(eq(productsTable.id, item.productId));
    if (product?.trackStock) {
      await db.update(productsTable).set({ stockQty: product.stockQty + Math.round(parseFloat(item.qty as any)) }).where(eq(productsTable.id, item.productId));
    }
  }

  await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
  await logHistory("DELETE", "invoice", id, `Deleted invoice ${inv?.invoiceNo || id}`);
  res.status(204).end();
});

router.post("/:id/duplicate", async (req, res) => {
  const id = parseInt(req.params.id);
  const original = await getInvoiceWithItems(id);
  if (!original) return res.status(404).json({ error: "Not found" });

  const invoiceNo = await nextInvoiceNo();
  const today = new Date().toISOString().split("T")[0];

  const [newInvoice] = await db.insert(invoicesTable).values({
    invoiceNo,
    customerName: original.customerName,
    date: today,
    total: String(original.total),
    deliveryId: null,
    note: original.note,
  }).returning();

  for (const item of original.items) {
    await db.insert(invoiceItemsTable).values({
      invoiceId: newInvoice.id,
      productId: item.productId,
      qty: String(item.qty),
      price: String(item.price),
      subtotal: String(item.subtotal),
    });
  }

  await logHistory("CREATE", "invoice", newInvoice.id, `Duplicated invoice ${original.invoiceNo} → ${invoiceNo}`);
  const full = await getInvoiceWithItems(newInvoice.id);
  res.status(201).json(full);
});

export { getInvoiceWithItems };
export default router;
