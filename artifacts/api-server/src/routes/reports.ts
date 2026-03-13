import { Router } from "express";
import { db, invoicesTable, invoiceItemsTable, productsTable, deliveriesTable } from "@workspace/db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard", async (req, res) => {
  const { date } = req.query as Record<string, string>;
  const today = date || new Date().toISOString().split("T")[0];

  // Today's invoices
  const todayInvoices = await db
    .select({
      id: invoicesTable.id,
      invoiceNo: invoicesTable.invoiceNo,
      customerName: invoicesTable.customerName,
      date: invoicesTable.date,
      total: invoicesTable.total,
      deliveryId: invoicesTable.deliveryId,
      note: invoicesTable.note,
    })
    .from(invoicesTable)
    .where(eq(invoicesTable.date, today))
    .orderBy(desc(invoicesTable.id));

  const totalSales = todayInvoices.reduce((s, i) => s + parseFloat(i.total as any), 0);

  // Products sold today
  let productsSold = 0;
  const todayIds = todayInvoices.map(i => i.id);
  const topProductsMap = new Map<number, { productId: number; productName: string; totalQty: number }>();

  for (const invId of todayIds) {
    const items = await db
      .select({ productId: invoiceItemsTable.productId, productName: productsTable.name, qty: invoiceItemsTable.qty })
      .from(invoiceItemsTable)
      .leftJoin(productsTable, eq(invoiceItemsTable.productId, productsTable.id))
      .where(eq(invoiceItemsTable.invoiceId, invId));
    for (const item of items) {
      const qty = parseFloat(item.qty as any);
      productsSold += qty;
      const existing = topProductsMap.get(item.productId);
      if (existing) {
        existing.totalQty += qty;
      } else {
        topProductsMap.set(item.productId, { productId: item.productId, productName: item.productName || "", totalQty: qty });
      }
    }
  }

  const topProducts = Array.from(topProductsMap.values()).sort((a, b) => b.totalQty - a.totalQty).slice(0, 5);

  // Low stock products
  const lowStockProducts = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      categoryId: productsTable.categoryId,
      categoryName: sql<string>`null`,
      basePrice: productsTable.basePrice,
      trackStock: productsTable.trackStock,
      stockQty: productsTable.stockQty,
      createdDate: productsTable.createdDate,
    })
    .from(productsTable)
    .where(and(eq(productsTable.trackStock, true), sql`${productsTable.stockQty} <= 5`));

  res.json({
    date: today,
    totalSales,
    invoiceCount: todayInvoices.length,
    productsSold,
    topProducts,
    recentInvoices: todayInvoices.slice(0, 10).map(i => ({
      ...i,
      total: parseFloat(i.total as any),
      deliveryNo: null,
      note: i.note || null,
    })),
    lowStockProducts: lowStockProducts.map(p => ({ ...p, basePrice: parseFloat(p.basePrice), categoryName: null })),
  });
});

router.get("/sales", async (req, res) => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const to = dateTo || new Date().toISOString().split("T")[0];

  const invoices = await db
    .select({
      id: invoicesTable.id,
      date: invoicesTable.date,
      total: invoicesTable.total,
    })
    .from(invoicesTable)
    .where(and(gte(invoicesTable.date, from), lte(invoicesTable.date, to)))
    .orderBy(invoicesTable.date);

  const byDateMap = new Map<string, { date: string; totalSales: number; invoiceCount: number }>();
  for (const inv of invoices) {
    const existing = byDateMap.get(inv.date);
    const t = parseFloat(inv.total as any);
    if (existing) {
      existing.totalSales += t;
      existing.invoiceCount++;
    } else {
      byDateMap.set(inv.date, { date: inv.date, totalSales: t, invoiceCount: 1 });
    }
  }

  // Top products
  const productTotals = new Map<number, { productId: number; productName: string; totalQty: number }>();
  for (const inv of invoices) {
    const items = await db
      .select({ productId: invoiceItemsTable.productId, productName: productsTable.name, qty: invoiceItemsTable.qty })
      .from(invoiceItemsTable)
      .leftJoin(productsTable, eq(invoiceItemsTable.productId, productsTable.id))
      .where(eq(invoiceItemsTable.invoiceId, inv.id));
    for (const item of items) {
      const qty = parseFloat(item.qty as any);
      const existing = productTotals.get(item.productId);
      if (existing) existing.totalQty += qty;
      else productTotals.set(item.productId, { productId: item.productId, productName: item.productName || "", totalQty: qty });
    }
  }

  const totalSales = invoices.reduce((s, i) => s + parseFloat(i.total as any), 0);

  res.json({
    dateFrom: from,
    dateTo: to,
    totalSales,
    totalInvoices: invoices.length,
    byDate: Array.from(byDateMap.values()),
    topProducts: Array.from(productTotals.values()).sort((a, b) => b.totalQty - a.totalQty).slice(0, 10),
  });
});

/* ── Delivery Report ──────────────────────────────────────────────────── */
router.get("/deliveries", async (req, res) => {
  const { date } = req.query as Record<string, string>;
  const targetDate = date || new Date().toISOString().split("T")[0];

  // Date may be stored as plain "YYYY-MM-DD" or full ISO "YYYY-MM-DDT…"
  // Use LIKE prefix so both formats match
  const deliveries = await db
    .select()
    .from(deliveriesTable)
    .where(sql`${deliveriesTable.date} LIKE ${targetDate + "%"}`)
    .orderBy(deliveriesTable.deliveryNo);

  const result = [];

  for (const delivery of deliveries) {
    // Invoices belonging to this delivery
    const invoices = await db
      .select({
        id: invoicesTable.id,
        invoiceNo: invoicesTable.invoiceNo,
        customerName: invoicesTable.customerName,
        total: invoicesTable.total,
        packingGroups: invoicesTable.packingGroups,
      })
      .from(invoicesTable)
      .where(eq(invoicesTable.deliveryId, delivery.id))
      .orderBy(invoicesTable.customerName);

    // Aggregate package summary from packing JSON across all invoices
    const pkgMap = new Map<string, number>();

    const invoiceDetails = [];
    for (const inv of invoices) {
      const items = await db
        .select({
          productName: productsTable.name,
          qty: invoiceItemsTable.qty,
          price: invoiceItemsTable.price,
        })
        .from(invoiceItemsTable)
        .leftJoin(productsTable, eq(invoiceItemsTable.productId, productsTable.id))
        .where(eq(invoiceItemsTable.invoiceId, inv.id));

      // Parse packingGroups JSON
      if (inv.packingGroups) {
        try {
          const groups = JSON.parse(inv.packingGroups) as { packageType: string; packageQty: number }[];
          for (const g of groups) {
            pkgMap.set(g.packageType, (pkgMap.get(g.packageType) ?? 0) + g.packageQty);
          }
        } catch {}
      }

      invoiceDetails.push({
        invoiceNo: inv.invoiceNo,
        customerName: inv.customerName,
        total: parseFloat(inv.total as any),
        items: items.map(i => ({
          productName: i.productName || "Unknown",
          qty: parseFloat(i.qty as any),
          price: parseFloat(i.price as any),
        })),
      });
    }

    // Group invoices by customer
    const customerMap = new Map<string, { customerName: string; invoices: typeof invoiceDetails }>();
    for (const inv of invoiceDetails) {
      const existing = customerMap.get(inv.customerName);
      if (existing) existing.invoices.push(inv);
      else customerMap.set(inv.customerName, { customerName: inv.customerName, invoices: [inv] });
    }

    result.push({
      delivery: {
        id: delivery.id,
        deliveryNo: delivery.deliveryNo,
        date: delivery.date,
        driver: delivery.driver,
        status: delivery.status,
      },
      customers: Array.from(customerMap.values()),
      packageSummary: [...pkgMap.entries()].map(([type, qty]) => ({ type, qty })),
      totalBills: invoices.length,
      grandTotal: invoices.reduce((s, i) => s + parseFloat(i.total as any), 0),
    });
  }

  res.json({ date: targetDate, deliveries: result });
});

export default router;
