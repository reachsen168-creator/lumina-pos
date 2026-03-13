import { Router } from "express";
import { db, productsTable, customersTable, deliveriesTable, invoicesTable, invoiceItemsTable } from "@workspace/db";
import { eq, isNotNull } from "drizzle-orm";
import { logHistory } from "./history.js";

const router = Router();

// ── GET /trash — aggregate all soft-deleted records ───────────────────────────
router.get("/", async (_req, res) => {
  const [deletedProducts, deletedCustomers, deletedDeliveries, deletedInvoices] = await Promise.all([
    db.select().from(productsTable).where(isNotNull(productsTable.deletedAt)),
    db.select().from(customersTable).where(isNotNull(customersTable.deletedAt)),
    db.select().from(deliveriesTable).where(isNotNull(deliveriesTable.deletedAt)),
    db.select().from(invoicesTable).where(isNotNull(invoicesTable.deletedAt)),
  ]);

  const records = [
    ...deletedProducts.map(r => ({
      type: "product", id: r.id, name: r.name,
      deletedAt: r.deletedAt, deletedBy: r.deletedBy || "Admin",
      meta: { basePrice: parseFloat(r.basePrice as any) },
    })),
    ...deletedCustomers.map(r => ({
      type: "customer", id: r.id, name: r.name,
      deletedAt: r.deletedAt, deletedBy: r.deletedBy || "Admin",
      meta: { phone: r.phone },
    })),
    ...deletedDeliveries.map(r => ({
      type: "delivery", id: r.id, name: r.deliveryNo,
      deletedAt: r.deletedAt, deletedBy: r.deletedBy || "Admin",
      meta: { driver: r.driver, status: r.status },
    })),
    ...deletedInvoices.map(r => ({
      type: "invoice", id: r.id, name: `${r.invoiceNo} — ${r.customerName}`,
      deletedAt: r.deletedAt, deletedBy: r.deletedBy || "Admin",
      meta: { invoiceNo: r.invoiceNo, customerName: r.customerName, total: parseFloat(r.total as any) },
    })),
  ].sort((a, b) => {
    const ta = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
    const tb = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
    return tb - ta;
  });

  res.json(records);
});

// ── POST /trash/:type/:id/restore ─────────────────────────────────────────────
router.post("/:type/:id/restore", async (req, res) => {
  const { type, id: idStr } = req.params;
  const id = parseInt(idStr);

  try {
    switch (type) {
      case "product": {
        const [r] = await db.select().from(productsTable).where(eq(productsTable.id, id));
        if (!r) return res.status(404).json({ error: "Not found" });
        await db.update(productsTable).set({ deletedAt: null, deletedBy: null }).where(eq(productsTable.id, id));
        await logHistory("UPDATE", "product", id, `Restored product: ${r.name}`);
        break;
      }
      case "customer": {
        const [r] = await db.select().from(customersTable).where(eq(customersTable.id, id));
        if (!r) return res.status(404).json({ error: "Not found" });
        await db.update(customersTable).set({ deletedAt: null, deletedBy: null }).where(eq(customersTable.id, id));
        await logHistory("UPDATE", "customer", id, `Restored customer: ${r.name}`);
        break;
      }
      case "delivery": {
        const [r] = await db.select().from(deliveriesTable).where(eq(deliveriesTable.id, id));
        if (!r) return res.status(404).json({ error: "Not found" });
        await db.update(deliveriesTable).set({ deletedAt: null, deletedBy: null }).where(eq(deliveriesTable.id, id));
        await logHistory("UPDATE", "delivery", id, `Restored delivery: ${r.deliveryNo}`);
        break;
      }
      case "invoice": {
        const [r] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
        if (!r) return res.status(404).json({ error: "Not found" });
        // Re-deduct stock (it was restored when soft-deleted)
        const items = await db
          .select({ productId: invoiceItemsTable.productId, qty: invoiceItemsTable.qty })
          .from(invoiceItemsTable)
          .where(eq(invoiceItemsTable.invoiceId, id));
        await db.transaction(async (tx) => {
          for (const item of items) {
            const [product] = await tx
              .select({ trackStock: productsTable.trackStock, stockQty: productsTable.stockQty })
              .from(productsTable)
              .where(eq(productsTable.id, item.productId));
            if (product?.trackStock) {
              const qty = parseFloat(item.qty as any);
              await tx.update(productsTable)
                .set({ stockQty: Math.max(0, product.stockQty - qty) })
                .where(eq(productsTable.id, item.productId));
            }
          }
          await tx.update(invoicesTable).set({ deletedAt: null, deletedBy: null }).where(eq(invoicesTable.id, id));
        });
        await logHistory("UPDATE", "invoice", id, `Restored invoice: ${r.invoiceNo} (${r.customerName})`);
        break;
      }
      default:
        return res.status(400).json({ error: "Unknown type" });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("Restore error:", e);
    res.status(500).json({ error: "Restore failed" });
  }
});

// ── DELETE /trash/:type/:id — permanent delete ────────────────────────────────
router.delete("/:type/:id", async (req, res) => {
  const { type, id: idStr } = req.params;
  const id = parseInt(idStr);

  try {
    switch (type) {
      case "product": {
        const [r] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, id));
        await db.delete(productsTable).where(eq(productsTable.id, id));
        await logHistory("DELETE", "product", id, `Permanently deleted product: ${r?.name || id}`);
        break;
      }
      case "customer": {
        const [r] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, id));
        await db.delete(customersTable).where(eq(customersTable.id, id));
        await logHistory("DELETE", "customer", id, `Permanently deleted customer: ${r?.name || id}`);
        break;
      }
      case "delivery": {
        const [r] = await db.select({ deliveryNo: deliveriesTable.deliveryNo }).from(deliveriesTable).where(eq(deliveriesTable.id, id));
        await db.delete(deliveriesTable).where(eq(deliveriesTable.id, id));
        await logHistory("DELETE", "delivery", id, `Permanently deleted delivery: ${r?.deliveryNo || id}`);
        break;
      }
      case "invoice": {
        const [r] = await db.select({ invoiceNo: invoicesTable.invoiceNo }).from(invoicesTable).where(eq(invoicesTable.id, id));
        // Invoice items cascade-delete via FK
        await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
        await logHistory("DELETE", "invoice", id, `Permanently deleted invoice: ${r?.invoiceNo || id}`);
        break;
      }
      default:
        return res.status(400).json({ error: "Unknown type" });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("Permanent delete error:", e);
    res.status(500).json({ error: "Permanent delete failed" });
  }
});

export default router;
