import { Router } from "express";
import { db, damagedItemsTable, productsTable, invoicesTable } from "@workspace/db";
import { eq, and, gte, lte, ilike } from "drizzle-orm";
import { logHistory } from "./history.js";

const router = Router();

async function getDamagedWithDetails(id: number) {
  const [item] = await db
    .select({
      id: damagedItemsTable.id,
      productId: damagedItemsTable.productId,
      productName: productsTable.name,
      qty: damagedItemsTable.qty,
      invoiceId: damagedItemsTable.invoiceId,
      invoiceNo: invoicesTable.invoiceNo,
      customerName: damagedItemsTable.customerName,
      damageReason: damagedItemsTable.damageReason,
      date: damagedItemsTable.date,
      status: damagedItemsTable.status,
    })
    .from(damagedItemsTable)
    .leftJoin(productsTable, eq(damagedItemsTable.productId, productsTable.id))
    .leftJoin(invoicesTable, eq(damagedItemsTable.invoiceId, invoicesTable.id))
    .where(eq(damagedItemsTable.id, id));
  return item;
}

router.get("/check/:productId", async (req, res) => {
  const productId = parseInt(req.params.productId);
  const items = await db.select({ id: damagedItemsTable.id }).from(damagedItemsTable).where(eq(damagedItemsTable.productId, productId));
  res.json({ productId, hasDamageHistory: items.length > 0, damageCount: items.length });
});

router.get("/", async (req, res) => {
  const { search, status, dateFrom, dateTo } = req.query as Record<string, string>;

  let query = db
    .select({
      id: damagedItemsTable.id,
      productId: damagedItemsTable.productId,
      productName: productsTable.name,
      qty: damagedItemsTable.qty,
      invoiceId: damagedItemsTable.invoiceId,
      invoiceNo: invoicesTable.invoiceNo,
      customerName: damagedItemsTable.customerName,
      damageReason: damagedItemsTable.damageReason,
      date: damagedItemsTable.date,
      status: damagedItemsTable.status,
    })
    .from(damagedItemsTable)
    .leftJoin(productsTable, eq(damagedItemsTable.productId, productsTable.id))
    .leftJoin(invoicesTable, eq(damagedItemsTable.invoiceId, invoicesTable.id))
    .$dynamic();

  const conditions = [];
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
  if (status) conditions.push(eq(damagedItemsTable.status, status));
  if (dateFrom) conditions.push(gte(damagedItemsTable.date, dateFrom));
  if (dateTo) conditions.push(lte(damagedItemsTable.date, dateTo));

  if (conditions.length) query = query.where(and(...conditions));

  const items = await query.orderBy(damagedItemsTable.date);
  res.json(items.map(i => ({ ...i, invoiceNo: i.invoiceNo || null })));
});

router.post("/", async (req, res) => {
  const { productId, qty, invoiceId, customerName, damageReason, date, status } = req.body;
  if (!productId || !qty || !date) return res.status(400).json({ error: "productId, qty, date required" });
  const [item] = await db.insert(damagedItemsTable).values({
    productId,
    qty,
    invoiceId: invoiceId || null,
    customerName: customerName || null,
    damageReason: damageReason || null,
    date,
    status: status || "Damaged",
  }).returning();
  await logHistory("CREATE", "damaged_item", item.id, `Recorded damaged item id: ${item.productId}`);
  const detail = await getDamagedWithDetails(item.id);
  res.status(201).json(detail);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { qty, damageReason, date, status } = req.body;
  const [item] = await db.update(damagedItemsTable).set({ qty, damageReason: damageReason || null, date, status }).where(eq(damagedItemsTable.id, id)).returning();
  if (!item) return res.status(404).json({ error: "Not found" });
  await logHistory("UPDATE", "damaged_item", id, `Updated damaged item status to: ${status}`);
  const detail = await getDamagedWithDetails(id);
  res.json(detail);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(damagedItemsTable).where(eq(damagedItemsTable.id, id));
  await logHistory("DELETE", "damaged_item", id, `Deleted damaged item id: ${id}`);
  res.status(204).end();
});

export default router;
