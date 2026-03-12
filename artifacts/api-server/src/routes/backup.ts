import { Router } from "express";
import { db, categoriesTable, productsTable, invoicesTable, invoiceItemsTable, deliveriesTable, damagedItemsTable, transfersTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/export", async (_req, res) => {
  const [categories, products, invoices, invoiceItems, deliveries, damagedItems, transfers] = await Promise.all([
    db.select().from(categoriesTable),
    db.select().from(productsTable),
    db.select().from(invoicesTable),
    db.select().from(invoiceItemsTable),
    db.select().from(deliveriesTable),
    db.select().from(damagedItemsTable),
    db.select().from(transfersTable),
  ]);

  res.json({
    exportedAt: new Date().toISOString(),
    categories,
    products,
    invoices,
    invoiceItems,
    deliveries,
    damagedItems,
    transfers,
  });
});

router.post("/import", async (req, res) => {
  const { categories, products, deliveries, invoices, invoiceItems, damagedItems, transfers } = req.body;

  try {
    // Clear existing data in order
    await db.delete(transfersTable);
    await db.delete(damagedItemsTable);
    await db.delete(invoiceItemsTable);
    await db.delete(invoicesTable);
    await db.delete(deliveriesTable);
    await db.delete(productsTable);
    await db.delete(categoriesTable);

    // Restore in order
    if (categories?.length) await db.insert(categoriesTable).values(categories.map((c: any) => ({ id: c.id, name: c.name })));
    if (products?.length) await db.insert(productsTable).values(products.map((p: any) => ({
      id: p.id, name: p.name, categoryId: p.categoryId, basePrice: String(p.basePrice || p.base_price || 0),
      trackStock: p.trackStock ?? p.track_stock ?? false, stockQty: p.stockQty ?? p.stock_qty ?? 0,
      createdDate: p.createdDate || p.created_date || new Date().toISOString().split("T")[0],
    })));
    if (deliveries?.length) await db.insert(deliveriesTable).values(deliveries.map((d: any) => ({
      id: d.id, deliveryNo: d.deliveryNo || d.delivery_no, date: d.date, driver: d.driver, status: d.status
    })));
    if (invoices?.length) await db.insert(invoicesTable).values(invoices.map((i: any) => ({
      id: i.id, invoiceNo: i.invoiceNo || i.invoice_no, customerName: i.customerName || i.customer_name,
      date: i.date, total: String(i.total || 0), deliveryId: i.deliveryId || i.delivery_id, note: i.note
    })));
    if (invoiceItems?.length) await db.insert(invoiceItemsTable).values(invoiceItems.map((i: any) => ({
      id: i.id, invoiceId: i.invoiceId || i.invoice_id, productId: i.productId || i.product_id,
      qty: String(i.qty), price: String(i.price), subtotal: String(i.subtotal)
    })));
    if (damagedItems?.length) await db.insert(damagedItemsTable).values(damagedItems.map((d: any) => ({
      id: d.id, productId: d.productId || d.product_id, qty: d.qty, invoiceId: d.invoiceId || d.invoice_id,
      customerName: d.customerName || d.customer_name, damageReason: d.damageReason || d.damage_reason,
      date: d.date, status: d.status
    })));
    if (transfers?.length) await db.insert(transfersTable).values(transfers.map((t: any) => ({
      id: t.id, productId: t.productId || t.product_id, qty: String(t.qty),
      fromInvoiceId: t.fromInvoiceId || t.from_invoice_id, toInvoiceId: t.toInvoiceId || t.to_invoice_id,
      date: t.date, note: t.note
    })));

    // Reset sequences
    await db.execute(sql`SELECT setval('categories_id_seq', COALESCE((SELECT MAX(id) FROM categories), 1))`);
    await db.execute(sql`SELECT setval('products_id_seq', COALESCE((SELECT MAX(id) FROM products), 1))`);
    await db.execute(sql`SELECT setval('invoices_id_seq', COALESCE((SELECT MAX(id) FROM invoices), 1))`);
    await db.execute(sql`SELECT setval('invoice_items_id_seq', COALESCE((SELECT MAX(id) FROM invoice_items), 1))`);
    await db.execute(sql`SELECT setval('deliveries_id_seq', COALESCE((SELECT MAX(id) FROM deliveries), 1))`);
    await db.execute(sql`SELECT setval('damaged_items_id_seq', COALESCE((SELECT MAX(id) FROM damaged_items), 1))`);
    await db.execute(sql`SELECT setval('transfers_id_seq', COALESCE((SELECT MAX(id) FROM transfers), 1))`);

    res.json({ success: true, message: "Data restored successfully" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
