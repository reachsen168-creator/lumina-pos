import { Router } from "express";
import { db, historyLogsTable } from "@workspace/db";
import { and, gte, lte, eq } from "drizzle-orm";

const router = Router();

export async function logHistory(action: string, entity: string, entityId: number | null, description: string) {
  const today = new Date().toISOString().split("T")[0];
  try {
    await db.insert(historyLogsTable).values({
      action,
      entity,
      entityId,
      description,
      date: today,
    });
  } catch (e) {
    console.error("Failed to log history:", e);
  }
}

router.get("/", async (req, res) => {
  const { action, entity, dateFrom, dateTo } = req.query as Record<string, string>;
  let query = db.select().from(historyLogsTable).$dynamic();

  const conditions = [];
  if (action) conditions.push(eq(historyLogsTable.action, action));
  if (entity) conditions.push(eq(historyLogsTable.entity, entity));
  if (dateFrom) conditions.push(gte(historyLogsTable.date, dateFrom));
  if (dateTo) conditions.push(lte(historyLogsTable.date, dateTo));

  if (conditions.length) query = query.where(and(...conditions));

  const logs = await query.orderBy(historyLogsTable.createdAt);
  res.json(logs.map((l) => ({
    id: l.id,
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    description: l.description,
    date: l.date,
  })));
});

export default router;
