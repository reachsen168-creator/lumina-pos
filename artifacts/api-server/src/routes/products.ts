import { Router } from "express";
import { db, productsTable, categoriesTable } from "@workspace/db";
import { eq, and, gte, lte, ilike, or, sql, isNull } from "drizzle-orm";
import { logHistory } from "./history.js";

const router = Router();

router.get("/", async (req, res) => {
  const { search, categoryId, dateFrom, dateTo } = req.query as Record<string, string>;

  const conditions: any[] = [isNull(productsTable.deletedAt)];
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
  if (categoryId) conditions.push(eq(productsTable.categoryId, parseInt(categoryId)));
  if (dateFrom) conditions.push(gte(productsTable.createdDate, dateFrom));
  if (dateTo) conditions.push(lte(productsTable.createdDate, dateTo));

  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      basePrice: productsTable.basePrice,
      trackStock: productsTable.trackStock,
      stockQty: productsTable.stockQty,
      createdDate: productsTable.createdDate,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(and(...conditions))
    .orderBy(productsTable.name);

  res.json(products.map((p) => ({
    ...p,
    basePrice: parseFloat(p.basePrice),
  })));
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [product] = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      basePrice: productsTable.basePrice,
      trackStock: productsTable.trackStock,
      stockQty: productsTable.stockQty,
      createdDate: productsTable.createdDate,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, id));
  if (!product) return res.status(404).json({ error: "Not found" });
  res.json({ ...product, basePrice: parseFloat(product.basePrice) });
});

router.post("/", async (req, res) => {
  const { name, categoryId, basePrice, trackStock, stockQty, createdDate } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const today = createdDate || new Date().toISOString().split("T")[0];
  const [p] = await db.insert(productsTable).values({
    name,
    categoryId: categoryId || null,
    basePrice: String(basePrice || 0),
    trackStock: !!trackStock,
    stockQty: stockQty || 0,
    createdDate: today,
  }).returning();
  await logHistory("CREATE", "product", p.id, `Created product: ${p.name}`);

  const [product] = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      basePrice: productsTable.basePrice,
      trackStock: productsTable.trackStock,
      stockQty: productsTable.stockQty,
      createdDate: productsTable.createdDate,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, p.id));

  res.status(201).json({ ...product, basePrice: parseFloat(product.basePrice) });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, categoryId, basePrice, trackStock, stockQty, createdDate } = req.body;
  await db.update(productsTable).set({
    name,
    categoryId: categoryId || null,
    basePrice: String(basePrice || 0),
    trackStock: !!trackStock,
    stockQty: stockQty || 0,
    createdDate,
  }).where(eq(productsTable.id, id));
  await logHistory("UPDATE", "product", id, `Updated product: ${name}`);

  const [product] = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      basePrice: productsTable.basePrice,
      trackStock: productsTable.trackStock,
      stockQty: productsTable.stockQty,
      createdDate: productsTable.createdDate,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, id));
  if (!product) return res.status(404).json({ error: "Not found" });
  res.json({ ...product, basePrice: parseFloat(product.basePrice) });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [p] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, id));
  await db.update(productsTable).set({ deletedAt: new Date(), deletedBy: "Admin" }).where(eq(productsTable.id, id));
  await logHistory("DELETE", "product", id, `Deleted product: ${p?.name || id}`);
  res.status(204).end();
});

export default router;
