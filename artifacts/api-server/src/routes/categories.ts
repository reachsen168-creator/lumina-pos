import { Router } from "express";
import { db, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logHistory } from "./history.js";

const router = Router();

router.get("/", async (_req, res) => {
  const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  res.json(cats.map((c) => ({ id: c.id, name: c.name })));
});

router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [cat] = await db.insert(categoriesTable).values({ name }).returning();
  await logHistory("CREATE", "category", cat.id, `Created category: ${cat.name}`);
  res.status(201).json({ id: cat.id, name: cat.name });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [cat] = await db.update(categoriesTable).set({ name }).where(eq(categoriesTable.id, id)).returning();
  if (!cat) return res.status(404).json({ error: "Not found" });
  await logHistory("UPDATE", "category", cat.id, `Updated category: ${cat.name}`);
  res.json({ id: cat.id, name: cat.name });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  await logHistory("DELETE", "category", id, `Deleted category id: ${id}`);
  res.status(204).end();
});

export default router;
