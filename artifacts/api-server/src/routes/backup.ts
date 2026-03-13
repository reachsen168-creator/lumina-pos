import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  db,
  categoriesTable,
  productsTable,
  customersTable,
  invoicesTable,
  invoiceItemsTable,
  deliveriesTable,
  damagedItemsTable,
  damageRecordsTable,
  transfersTable,
  historyLogsTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.resolve(__dirname, "../../backups");
const MAX_BACKUPS = 7;

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// ── Build full backup payload ─────────────────────────────────────────────────
async function buildBackupPayload() {
  const [
    categories, products, customers, invoices, invoiceItems,
    deliveries, damagedItems, damageRecords, transfers, historyLogs,
  ] = await Promise.all([
    db.select().from(categoriesTable),
    db.select().from(productsTable),
    db.select().from(customersTable),
    db.select().from(invoicesTable),
    db.select().from(invoiceItemsTable),
    db.select().from(deliveriesTable),
    db.select().from(damagedItemsTable),
    db.select().from(damageRecordsTable),
    db.select().from(transfersTable),
    db.select().from(historyLogsTable),
  ]);

  return {
    version: "2",
    exportedAt: new Date().toISOString(),
    categories,
    products,
    customers,
    invoices,
    invoiceItems,
    deliveries,
    damagedItems,
    damageRecords,
    transfers,
    historyLogs,
  };
}

// ── Save backup to disk + prune to MAX_BACKUPS ────────────────────────────────
async function saveBackupToDisk(): Promise<{ filename: string; sizeBytes: number }> {
  const payload = await buildBackupPayload();
  const dateStr = new Date().toISOString().split("T")[0];
  const timestamp = Date.now();
  const filename = `lumina-pos-backup-${dateStr}-${timestamp}.json`;
  const filepath = path.join(BACKUP_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(payload, null, 2), "utf8");
  const sizeBytes = fs.statSync(filepath).size;

  // Prune oldest beyond MAX_BACKUPS
  const all = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith("lumina-pos-backup-") && f.endsWith(".json"))
    .map(f => ({ f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const old of all.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(BACKUP_DIR, old.f));
  }

  return { filename, sizeBytes };
}

// ── Auto-backup every 24 hours ────────────────────────────────────────────────
let autoBackupTimer: ReturnType<typeof setInterval> | null = null;

function startAutoBackup() {
  if (autoBackupTimer) return;
  const run = async () => {
    try {
      const { filename } = await saveBackupToDisk();
      console.log(`[Auto-Backup] Created: ${filename}`);
    } catch (e) {
      console.error("[Auto-Backup] Failed:", e);
    }
  };
  // First run after 5s (let server finish starting), then every 24h
  setTimeout(() => {
    run();
    autoBackupTimer = setInterval(run, 24 * 60 * 60 * 1000);
  }, 5000);
}
startAutoBackup();

// ── GET /backup/list ──────────────────────────────────────────────────────────
router.get("/list", (_req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("lumina-pos-backup-") && f.endsWith(".json"))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { filename: f, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(files);
  } catch {
    res.json([]);
  }
});

// ── POST /backup/create — manual backup stored to disk ────────────────────────
router.post("/create", async (_req, res) => {
  try {
    const { filename, sizeBytes } = await saveBackupToDisk();
    res.json({ ok: true, filename, sizeBytes });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── GET /backup/download/:filename ────────────────────────────────────────────
router.get("/download/:filename", (req, res) => {
  const { filename } = req.params;
  if (!filename.startsWith("lumina-pos-backup-") || !filename.endsWith(".json")) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: "Not found" });
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "application/json");
  res.sendFile(filepath);
});

// ── GET /backup/export — legacy direct download ───────────────────────────────
router.get("/export", async (_req, res) => {
  try {
    const payload = await buildBackupPayload();
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `lumina-pos-backup-${dateStr}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json");
    res.json(payload);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /backup/import ───────────────────────────────────────────────────────
router.post("/import", async (req, res) => {
  const {
    categories, products, customers, invoices, invoiceItems,
    deliveries, damagedItems, damageRecords, transfers, historyLogs,
  } = req.body;

  if (!categories && !products && !invoices) {
    return res.status(400).json({ success: false, message: "Invalid backup file structure" });
  }

  try {
    // Clear in dependency order
    await db.delete(transfersTable);
    await db.delete(damagedItemsTable);
    await db.delete(damageRecordsTable);
    await db.delete(historyLogsTable);
    await db.delete(invoiceItemsTable);
    await db.delete(invoicesTable);
    await db.delete(customersTable);
    await db.delete(deliveriesTable);
    await db.delete(productsTable);
    await db.delete(categoriesTable);

    if (categories?.length) {
      await db.insert(categoriesTable).values(
        categories.map((c: any) => ({ id: c.id, name: c.name }))
      );
    }
    if (products?.length) {
      await db.insert(productsTable).values(
        products.map((p: any) => ({
          id: p.id, name: p.name,
          categoryId: p.categoryId ?? p.category_id ?? null,
          basePrice: String(p.basePrice ?? p.base_price ?? 0),
          trackStock: p.trackStock ?? p.track_stock ?? false,
          stockQty: Number(p.stockQty ?? p.stock_qty ?? 0),
          createdDate: p.createdDate ?? p.created_date ?? new Date().toISOString().split("T")[0],
          deletedAt: p.deletedAt ?? null,
          deletedBy: p.deletedBy ?? null,
        }))
      );
    }
    if (customers?.length) {
      await db.insert(customersTable).values(
        customers.map((c: any) => ({
          id: c.id, name: c.name,
          phone: c.phone ?? null, note: c.note ?? null,
          createdDate: c.createdDate ?? c.created_date ?? new Date().toISOString().split("T")[0],
          deletedAt: c.deletedAt ?? null, deletedBy: c.deletedBy ?? null,
        }))
      );
    }
    if (deliveries?.length) {
      await db.insert(deliveriesTable).values(
        deliveries.map((d: any) => ({
          id: d.id, deliveryNo: d.deliveryNo ?? d.delivery_no, date: d.date,
          driver: d.driver ?? null, status: d.status ?? "Pending",
          deletedAt: d.deletedAt ?? null, deletedBy: d.deletedBy ?? null,
        }))
      );
    }
    if (invoices?.length) {
      await db.insert(invoicesTable).values(
        invoices.map((i: any) => ({
          id: i.id, invoiceNo: i.invoiceNo ?? i.invoice_no,
          customerName: i.customerName ?? i.customer_name, date: i.date,
          total: String(i.total ?? 0),
          deliveryId: i.deliveryId ?? i.delivery_id ?? null,
          note: i.note ?? null, status: i.status ?? "Completed",
          packingGroups: i.packingGroups ?? null,
          deletedAt: i.deletedAt ?? null, deletedBy: i.deletedBy ?? null,
        }))
      );
    }
    if (invoiceItems?.length) {
      await db.insert(invoiceItemsTable).values(
        invoiceItems.map((i: any) => ({
          id: i.id, invoiceId: i.invoiceId ?? i.invoice_id,
          productId: i.productId ?? i.product_id,
          qty: String(i.qty), price: String(i.price), subtotal: String(i.subtotal),
          unit: i.unit ?? null, damagedQty: i.damagedQty != null ? String(i.damagedQty) : "0",
        }))
      );
    }
    if (damagedItems?.length) {
      await db.insert(damagedItemsTable).values(
        damagedItems.map((d: any) => ({
          id: d.id, productId: d.productId ?? d.product_id, qty: d.qty,
          invoiceId: d.invoiceId ?? d.invoice_id ?? null,
          customerName: d.customerName ?? d.customer_name ?? null,
          damageReason: d.damageReason ?? d.damage_reason ?? null,
          date: d.date, status: d.status ?? "Damaged",
        }))
      );
    }
    if (damageRecords?.length) {
      await db.insert(damageRecordsTable).values(
        damageRecords.map((d: any) => ({
          id: d.id, itemName: d.itemName, productId: d.productId ?? null,
          damageQty: String(d.damageQty), repairedQty: String(d.repairedQty ?? 0),
          soldQty: String(d.soldQty ?? 0), disposedQty: String(d.disposedQty ?? 0),
          remainingQty: String(d.remainingQty ?? d.damageQty),
          invoiceNumber: d.invoiceNumber ?? null, customerName: d.customerName ?? null,
          damageDate: d.damageDate, damageReason: d.damageReason ?? null,
          status: d.status ?? "Damaged", soldTo: d.soldTo ?? null, saleInvoice: d.saleInvoice ?? null,
        }))
      );
    }
    if (transfers?.length) {
      await db.insert(transfersTable).values(
        transfers.map((t: any) => ({
          id: t.id, productId: t.productId ?? t.product_id,
          qty: String(t.qty),
          fromInvoiceId: t.fromInvoiceId ?? t.from_invoice_id ?? null,
          toInvoiceId: t.toInvoiceId ?? t.to_invoice_id ?? null,
          date: t.date, note: t.note ?? null,
          itemName: t.itemName ?? null, fromInvoiceNo: t.fromInvoiceNo ?? null,
          fromCustomerName: t.fromCustomerName ?? null, toInvoiceNo: t.toInvoiceNo ?? null,
          toCustomerName: t.toCustomerName ?? null, createdBy: t.createdBy ?? "Admin",
          isReversed: t.isReversed ?? false, reversedAt: t.reversedAt ?? null,
        }))
      );
    }
    if (historyLogs?.length) {
      await db.insert(historyLogsTable).values(
        historyLogs.map((h: any) => ({
          id: h.id, user: h.user ?? "Admin", action: h.action, entity: h.entity,
          entityId: h.entityId ?? null, description: h.description, date: h.date,
        }))
      );
    }

    // Reset all sequences
    const seqPairs: [string, string][] = [
      ["categories", "categories_id_seq"],
      ["products", "products_id_seq"],
      ["customers", "customers_id_seq"],
      ["invoices", "invoices_id_seq"],
      ["invoice_items", "invoice_items_id_seq"],
      ["deliveries", "deliveries_id_seq"],
      ["damaged_items", "damaged_items_id_seq"],
      ["damage_records", "damage_records_id_seq"],
      ["transfers", "transfers_id_seq"],
      ["history_logs", "history_logs_id_seq"],
    ];
    for (const [table, seq] of seqPairs) {
      await db.execute(sql.raw(`SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM ${table}), 1))`));
    }

    res.json({ success: true, message: "Data restored successfully" });
  } catch (e: any) {
    console.error("Restore error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
