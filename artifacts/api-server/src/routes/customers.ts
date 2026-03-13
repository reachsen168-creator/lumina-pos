import { Router } from "express";
import { db, invoicesTable, invoiceItemsTable, productsTable, customersTable } from "@workspace/db";
import { eq, and, gte, lte, ilike, desc, isNull } from "drizzle-orm";
import { logHistory } from "./history.js";

const router = Router();

// ── Customer CRUD ────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const { search } = req.query as Record<string, string>;
  const conditions: any[] = [isNull(customersTable.deletedAt)];
  if (search) conditions.push(ilike(customersTable.name, `%${search}%`));
  const rows = await db
    .select()
    .from(customersTable)
    .where(and(...conditions))
    .orderBy(customersTable.name);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { name, phone, note, createdDate } = req.body;
  if (!name || !createdDate) {
    return res.status(400).json({ error: "name and createdDate are required" });
  }
  const [row] = await db
    .insert(customersTable)
    .values({ name: name.trim(), phone: phone || null, note: note || null, createdDate })
    .returning();
  await logHistory("CREATE", "customer", row.id, `Created customer: ${row.name}`);
  res.status(201).json(row);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, phone, note, createdDate } = req.body;
  if (!name || !createdDate) {
    return res.status(400).json({ error: "name and createdDate are required" });
  }
  const [row] = await db
    .update(customersTable)
    .set({ name: name.trim(), phone: phone || null, note: note || null, createdDate })
    .where(eq(customersTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Customer not found" });
  await logHistory("UPDATE", "customer", row.id, `Updated customer: ${row.name}`);
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  await db.update(customersTable).set({ deletedAt: new Date(), deletedBy: "Admin" }).where(eq(customersTable.id, id));
  await logHistory("DELETE", "customer", id, `Deleted customer: ${existing?.name || id}`);
  res.status(204).end();
});

// ── Customer Names (for datalist hints) ──────────────────────────────────────

router.get("/names", async (_req, res) => {
  const fromCustomers = await db
    .selectDistinct({ name: customersTable.name })
    .from(customersTable)
    .orderBy(customersTable.name);
  const fromInvoices = await db
    .selectDistinct({ customerName: invoicesTable.customerName })
    .from(invoicesTable)
    .orderBy(invoicesTable.customerName);

  const allNames = new Set<string>([
    ...fromCustomers.map(r => r.name),
    ...fromInvoices.map(r => r.customerName),
  ]);
  res.json([...allNames].sort());
});

// ── Customer Purchase History ─────────────────────────────────────────────────

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
