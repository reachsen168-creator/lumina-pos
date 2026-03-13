import { Router } from "express";
import { db, deliveriesTable, invoicesTable, invoiceItemsTable, productsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { logHistory } from "./history.js";

const router = Router();

router.get("/", async (_req, res) => {
  const deliveries = await db.select().from(deliveriesTable).where(isNull(deliveriesTable.deletedAt)).orderBy(deliveriesTable.deliveryNo);
  res.json(deliveries.map(d => ({
    id: d.id, deliveryNo: d.deliveryNo, date: d.date, driver: d.driver, status: d.status
  })));
});

router.post("/", async (req, res) => {
  const { deliveryNo, date, driver, status } = req.body;
  if (!deliveryNo || !date) return res.status(400).json({ error: "deliveryNo and date required" });
  const [d] = await db.insert(deliveriesTable).values({
    deliveryNo, date, driver: driver || null, status: status || "Pending"
  }).returning();
  await logHistory("CREATE", "delivery", d.id, `Created delivery: ${d.deliveryNo}`);
  res.status(201).json({ id: d.id, deliveryNo: d.deliveryNo, date: d.date, driver: d.driver, status: d.status });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { deliveryNo, date, driver, status } = req.body;
  const [d] = await db.update(deliveriesTable).set({ deliveryNo, date, driver: driver || null, status }).where(eq(deliveriesTable.id, id)).returning();
  if (!d) return res.status(404).json({ error: "Not found" });
  await logHistory("UPDATE", "delivery", d.id, `Updated delivery: ${d.deliveryNo}`);
  res.json({ id: d.id, deliveryNo: d.deliveryNo, date: d.date, driver: d.driver, status: d.status });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [d] = await db.select({ deliveryNo: deliveriesTable.deliveryNo }).from(deliveriesTable).where(eq(deliveriesTable.id, id));
  await db.update(deliveriesTable).set({ deletedAt: new Date(), deletedBy: "Admin" }).where(eq(deliveriesTable.id, id));
  await logHistory("DELETE", "delivery", id, `Deleted delivery: ${d?.deliveryNo || id}`);
  res.status(204).end();
});

router.get("/:id/detail", async (req, res) => {
  const id = parseInt(req.params.id);
  const [delivery] = await db.select().from(deliveriesTable).where(eq(deliveriesTable.id, id));
  if (!delivery) return res.status(404).json({ error: "Not found" });

  const invoices = await db
    .select({ id: invoicesTable.id, invoiceNo: invoicesTable.invoiceNo, customerName: invoicesTable.customerName, date: invoicesTable.date, total: invoicesTable.total, note: invoicesTable.note })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.deliveryId, id), isNull(invoicesTable.deletedAt)))
    .orderBy(invoicesTable.customerName);

  // Load items for all invoices
  const invoiceIds = invoices.map(i => i.id);
  let allItems: any[] = [];
  if (invoiceIds.length) {
    for (const invId of invoiceIds) {
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
        .where(eq(invoiceItemsTable.invoiceId, invId));
      allItems.push(...items);
    }
  }

  // Group by customer
  const customerMap = new Map<string, { customerName: string; invoices: any[]; customerTotal: number }>();
  for (const inv of invoices) {
    const items = allItems.filter(i => i.invoiceId === inv.id).map(i => ({
      id: i.id, invoiceId: i.invoiceId, productId: i.productId,
      productName: i.productName, qty: parseFloat(i.qty), price: parseFloat(i.price),
      subtotal: parseFloat(i.subtotal), isDamaged: false
    }));
    const invoiceWithItems = { ...inv, total: parseFloat(inv.total as any), deliveryId: id, deliveryNo: delivery.deliveryNo, items };
    const existing = customerMap.get(inv.customerName);
    if (existing) {
      existing.invoices.push(invoiceWithItems);
      existing.customerTotal += parseFloat(inv.total as any);
    } else {
      customerMap.set(inv.customerName, {
        customerName: inv.customerName,
        invoices: [invoiceWithItems],
        customerTotal: parseFloat(inv.total as any),
      });
    }
  }

  // Product summary
  const productTotals = new Map<number, { productId: number; productName: string; totalQty: number }>();
  for (const item of allItems) {
    const existing = productTotals.get(item.productId);
    const qty = parseFloat(item.qty);
    if (existing) {
      existing.totalQty += qty;
    } else {
      productTotals.set(item.productId, { productId: item.productId, productName: item.productName, totalQty: qty });
    }
  }

  const grandTotal = invoices.reduce((sum, i) => sum + parseFloat(i.total as any), 0);

  res.json({
    delivery: { id: delivery.id, deliveryNo: delivery.deliveryNo, date: delivery.date, driver: delivery.driver, status: delivery.status },
    customerGroups: Array.from(customerMap.values()),
    productSummary: Array.from(productTotals.values()),
    grandTotal,
  });
});

export default router;
