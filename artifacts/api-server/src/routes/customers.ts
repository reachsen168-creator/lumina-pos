import { Router } from "express";
import { db, invoicesTable, invoiceItemsTable, productsTable } from "@workspace/db";
import { eq, and, gte, lte, ilike, sql, desc } from "drizzle-orm";

const router = Router();

router.get("/names", async (_req, res) => {
  const result = await db
    .selectDistinct({ customerName: invoicesTable.customerName })
    .from(invoicesTable)
    .orderBy(invoicesTable.customerName);
  res.json(result.map(r => r.customerName));
});

router.get("/history", async (req, res) => {
  const { customerName, productName, dateFrom, dateTo } = req.query as Record<string, string>;

  const conditions = [];
  if (customerName) conditions.push(ilike(invoicesTable.customerName, `%${customerName}%`));
  if (dateFrom) conditions.push(gte(invoicesTable.date, dateFrom));
  if (dateTo) conditions.push(lte(invoicesTable.date, dateTo));

  let invoices = await db
    .select({
      id: invoicesTable.id,
      invoiceNo: invoicesTable.invoiceNo,
      customerName: invoicesTable.customerName,
      date: invoicesTable.date,
      total: invoicesTable.total,
    })
    .from(invoicesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(invoicesTable.customerName, desc(invoicesTable.date));

  const result = [];
  for (const inv of invoices) {
    const itemConditions = [eq(invoiceItemsTable.invoiceId, inv.id)];
    if (productName) {
      // Filter via join
    }
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
      .where(eq(invoiceItemsTable.invoiceId, inv.id));

    const mappedItems = items.map(i => ({
      id: i.id,
      invoiceId: i.invoiceId,
      productId: i.productId,
      productName: i.productName || "",
      qty: parseFloat(i.qty as any),
      price: parseFloat(i.price as any),
      subtotal: parseFloat(i.subtotal as any),
      isDamaged: false,
    }));

    // Filter by product name if specified
    if (productName && !mappedItems.some(i => i.productName.toLowerCase().includes(productName.toLowerCase()))) {
      continue;
    }

    result.push({
      customerName: inv.customerName,
      invoiceNo: inv.invoiceNo,
      invoiceId: inv.id,
      date: inv.date,
      total: parseFloat(inv.total as any),
      items: mappedItems,
    });
  }

  res.json(result);
});

export default router;
