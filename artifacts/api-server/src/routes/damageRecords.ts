import { Router } from "express";
import { db, damageRecordsTable, productsTable } from "@workspace/db";
import { eq, and, ilike, gte, lte, sql } from "drizzle-orm";
import { logHistory } from "./history.js";

const router = Router();

function computeStatus(repairedQty: number, damageQty: number, disposedQty: number): string {
  const remaining = damageQty - repairedQty - disposedQty;
  if (disposedQty > 0 && remaining <= 0) return "Disposed";
  if (disposedQty > 0 && remaining > 0)  return "Partially Disposed";
  if (repairedQty >= damageQty)          return "Ready to Sell";
  if (repairedQty > 0)                   return "Partially Repaired";
  return "Damaged";
}

/* ── List ────────────────────────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const { search, status, dateFrom, dateTo } = req.query as Record<string, string>;
    let query = db.select().from(damageRecordsTable).$dynamic();

    const conditions = [];
    if (search)   conditions.push(ilike(damageRecordsTable.itemName, `%${search}%`));
    if (status)   conditions.push(eq(damageRecordsTable.status, status));
    if (dateFrom) conditions.push(gte(damageRecordsTable.damageDate, dateFrom));
    if (dateTo)   conditions.push(lte(damageRecordsTable.damageDate, dateTo));
    if (conditions.length) query = query.where(and(...conditions));

    const rows = await query.orderBy(damageRecordsTable.createdAt);
    res.json(rows.map(r => ({
      ...r,
      damageQty:   parseFloat(r.damageQty   as any),
      repairedQty: parseFloat(r.repairedQty as any),
      soldQty:     parseFloat(r.soldQty     as any),
      disposedQty: parseFloat((r as any).disposedQty ?? "0"),
      remainingQty:parseFloat(r.remainingQty as any),
    })));
  } catch (e) { console.error(e); res.status(500).json({ error: "Failed to fetch damage records" }); }
});

/* ── Available repaired items (for SaleForm) ─────────────────────────────── */
router.get("/available-repaired", async (req, res) => {
  try {
    const rows = await db.select().from(damageRecordsTable);
    const available = rows
      .map(r => ({
        id:            r.id,
        itemName:      r.itemName,
        productId:     r.productId,
        repairedQty:   parseFloat(r.repairedQty as any),
        soldQty:       parseFloat(r.soldQty as any),
        availableQty:  parseFloat(r.repairedQty as any) - parseFloat(r.soldQty as any),
      }))
      .filter(r => r.availableQty > 0);
    res.json(available);
  } catch (e) { res.status(500).json({ error: "Failed to fetch repaired items" }); }
});

/* ── Damage Report ───────────────────────────────────────────────────────── */
router.get("/report", async (req, res) => {
  try {
    const rows = await db.select().from(damageRecordsTable);
    const map = new Map<string, { item: string; totalDamaged: number; totalRepaired: number; totalSold: number; remaining: number }>();
    for (const r of rows) {
      const key = r.itemName;
      const d   = parseFloat(r.damageQty   as any);
      const rp  = parseFloat(r.repairedQty as any);
      const sl  = parseFloat(r.soldQty     as any);
      const rm  = parseFloat(r.remainingQty as any);
      if (map.has(key)) {
        const e = map.get(key)!;
        e.totalDamaged  += d;
        e.totalRepaired += rp;
        e.totalSold     += sl;
        e.remaining     += rm;
      } else {
        map.set(key, { item: key, totalDamaged: d, totalRepaired: rp, totalSold: sl, remaining: rm });
      }
    }
    res.json([...map.values()]);
  } catch (e) { res.status(500).json({ error: "Failed to fetch damage report" }); }
});

/* ── Create ──────────────────────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const { itemName, productId, damageQty, invoiceNumber, customerName, damageDate, damageReason } = req.body;
    if (!itemName || !damageQty || !damageDate) {
      return res.status(400).json({ error: "itemName, damageQty, damageDate required" });
    }
    const qty = parseFloat(damageQty);
    const [row] = await db.insert(damageRecordsTable).values({
      itemName,
      productId:     productId ?? null,
      damageQty:     qty.toString(),
      repairedQty:   "0",
      soldQty:       "0",
      remainingQty:  qty.toString(),
      invoiceNumber: invoiceNumber ?? null,
      customerName:  customerName  ?? null,
      damageDate,
      damageReason:  damageReason  ?? null,
      status:        "Damaged",
    }).returning();
    await logHistory("CREATE", "damage_record", row.id, `Damage recorded: ${qty} × ${itemName}`);
    res.status(201).json({ ...row, damageQty: qty, repairedQty: 0, soldQty: 0, remainingQty: qty });
  } catch (e) { console.error(e); res.status(500).json({ error: "Failed to create damage record" }); }
});

/* ── Repair ──────────────────────────────────────────────────────────────── */
router.put("/:id/repair", async (req, res) => {
  try {
    const id          = parseInt(req.params.id);
    const { repairQty } = req.body;
    if (!repairQty || repairQty <= 0) return res.status(400).json({ error: "repairQty must be > 0" });

    const [existing] = await db.select().from(damageRecordsTable).where(eq(damageRecordsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });

    const damageQty   = parseFloat(existing.damageQty   as any);
    const currentRep  = parseFloat(existing.repairedQty as any);
    const maxRepair   = damageQty - currentRep;

    if (repairQty > maxRepair) {
      return res.status(400).json({ error: `Can only repair up to ${maxRepair} more units` });
    }

    const disposedQty  = parseFloat((existing as any).disposedQty ?? "0");
    const newRepaired  = currentRep + repairQty;
    const newRemaining = damageQty - newRepaired - disposedQty;
    const newStatus    = computeStatus(newRepaired, damageQty, disposedQty);

    const [updated] = await db.update(damageRecordsTable).set({
      repairedQty:  newRepaired.toString(),
      remainingQty: newRemaining.toString(),
      status:       newStatus,
    }).where(eq(damageRecordsTable.id, id)).returning();

    await logHistory("UPDATE", "damage_record", id, `Repaired ${repairQty} units of ${existing.itemName}`);
    res.json({ ...updated, damageQty: parseFloat(updated.damageQty as any), repairedQty: newRepaired, soldQty: parseFloat(updated.soldQty as any), disposedQty, remainingQty: newRemaining });
  } catch (e) { console.error(e); res.status(500).json({ error: "Failed to repair" }); }
});

/* ── Sell repaired items ──────────────────────────────────────────────────── */
router.put("/:id/sell", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { sellQty, soldTo, saleInvoice } = req.body;
    if (!sellQty || sellQty <= 0) return res.status(400).json({ error: "sellQty must be > 0" });

    const [existing] = await db.select().from(damageRecordsTable).where(eq(damageRecordsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });

    const repairedQty   = parseFloat(existing.repairedQty as any);
    const currentSold   = parseFloat(existing.soldQty     as any);
    const availableRep  = repairedQty - currentSold;

    if (sellQty > availableRep) {
      return res.status(400).json({ error: `Only ${availableRep} repaired units available to sell` });
    }

    const newSold      = currentSold + sellQty;
    const damageQty    = parseFloat(existing.damageQty   as any);
    const newRemaining = damageQty - parseFloat(existing.repairedQty as any);

    const [updated] = await db.update(damageRecordsTable).set({
      soldQty:     newSold.toString(),
      remainingQty: newRemaining.toString(),
      soldTo:      soldTo      ?? existing.soldTo,
      saleInvoice: saleInvoice ?? existing.saleInvoice,
    }).where(eq(damageRecordsTable.id, id)).returning();

    await logHistory("UPDATE", "damage_record", id, `Sold ${sellQty} repaired ${existing.itemName} to ${soldTo}`);
    res.json({ ...updated, damageQty: parseFloat(updated.damageQty as any), repairedQty: parseFloat(updated.repairedQty as any), soldQty: newSold, remainingQty: newRemaining });
  } catch (e) { console.error(e); res.status(500).json({ error: "Failed to record sale" }); }
});

/* ── Dispose damaged items ───────────────────────────────────────────────── */
router.put("/:id/dispose", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { disposeQty, disposeReason } = req.body;
    if (!disposeQty || disposeQty <= 0) return res.status(400).json({ error: "disposeQty must be > 0" });

    const [existing] = await db.select().from(damageRecordsTable).where(eq(damageRecordsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });

    const damageQty    = parseFloat(existing.damageQty    as any);
    const repairedQty  = parseFloat(existing.repairedQty  as any);
    const currentDisp  = parseFloat((existing as any).disposedQty ?? "0");
    const maxDispose   = parseFloat(existing.remainingQty as any);

    if (disposeQty > maxDispose) {
      return res.status(400).json({ error: `Can only dispose up to ${maxDispose} remaining units` });
    }

    const newDisposed  = currentDisp + disposeQty;
    const newRemaining = damageQty - repairedQty - newDisposed;
    const newStatus    = computeStatus(repairedQty, damageQty, newDisposed);

    const [updated] = await db.update(damageRecordsTable).set({
      disposedQty:  newDisposed.toString(),
      remainingQty: Math.max(0, newRemaining).toString(),
      status:       newStatus,
    } as any).where(eq(damageRecordsTable.id, id)).returning();

    const reason = disposeReason ? ` — reason: ${disposeReason}` : "";
    await logHistory("UPDATE", "damage_record", id, `Disposed ${disposeQty} units of ${existing.itemName}${reason}`);
    res.json({
      ...updated,
      damageQty,
      repairedQty,
      soldQty:     parseFloat(updated.soldQty as any),
      disposedQty: newDisposed,
      remainingQty: Math.max(0, newRemaining),
    });
  } catch (e) { console.error(e); res.status(500).json({ error: "Failed to dispose" }); }
});

/* ── View History for a record ───────────────────────────────────────────── */
router.get("/:id/history", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { historyLogsTable } = await import("@workspace/db");
    const { desc: descOrd } = await import("drizzle-orm");
    const logs = await db
      .select()
      .from(historyLogsTable)
      .where(
        and(
          eq(historyLogsTable.entity, "damage_record"),
          eq(historyLogsTable.entityId, id),
        )
      )
      .orderBy(descOrd(historyLogsTable.createdAt))
      .limit(20);
    res.json(logs);
  } catch (e) { res.status(500).json({ error: "Failed to fetch history" }); }
});

/* ── Delete ──────────────────────────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(damageRecordsTable).where(eq(damageRecordsTable.id, id));
    await logHistory("DELETE", "damage_record", id, `Deleted damage record id: ${id}`);
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: "Failed to delete" }); }
});

export default router;
