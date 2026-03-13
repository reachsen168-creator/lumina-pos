import { Router } from "express";
import { db, invoicesTable, invoiceItemsTable, productsTable, deliveriesTable } from "@workspace/db";
import { eq, and, gte, lte, desc, sql, ilike } from "drizzle-orm";

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

/* ── Full Sales Report ────────────────────────────────────────────────── */
router.get("/sales-full", async (req, res) => {
  const { dateFrom, dateTo, customer = "" } = req.query as Record<string, string>;
  const from = dateFrom || new Date().toISOString().split("T")[0];
  const to   = dateTo   || new Date().toISOString().split("T")[0];

  const conditions: any[] = [
    gte(invoicesTable.date, from),
    lte(invoicesTable.date, to),
  ];
  if (customer.trim()) {
    conditions.push(ilike(invoicesTable.customerName, `%${customer.trim()}%`));
  }

  const invoices = await db
    .select({
      id:           invoicesTable.id,
      invoiceNo:    invoicesTable.invoiceNo,
      date:         invoicesTable.date,
      createdAt:    invoicesTable.createdAt,
      customerName: invoicesTable.customerName,
      total:        invoicesTable.total,
    })
    .from(invoicesTable)
    .where(and(...conditions))
    .orderBy(desc(invoicesTable.createdAt));

  const itemMap     = new Map<string, number>();
  const customerMap = new Map<string, { totalBills: number; totalAmount: number }>();
  let totalItemsSold = 0;
  const invoiceDetails = [];

  for (const inv of invoices) {
    const items = await db
      .select({
        productName: productsTable.name,
        qty:         invoiceItemsTable.qty,
        price:       invoiceItemsTable.price,
      })
      .from(invoiceItemsTable)
      .leftJoin(productsTable, eq(invoiceItemsTable.productId, productsTable.id))
      .where(eq(invoiceItemsTable.invoiceId, inv.id));

    const mapped = items.map(i => ({
      productName: i.productName || "Unknown",
      qty:         parseFloat(i.qty as any),
      price:       parseFloat(i.price as any),
    }));

    for (const it of mapped) {
      itemMap.set(it.productName, (itemMap.get(it.productName) ?? 0) + it.qty);
      totalItemsSold += it.qty;
    }

    const total = parseFloat(inv.total as any);
    const cust  = customerMap.get(inv.customerName);
    if (cust) { cust.totalBills++; cust.totalAmount += total; }
    else customerMap.set(inv.customerName, { totalBills: 1, totalAmount: total });

    invoiceDetails.push({
      invoiceNo:    inv.invoiceNo,
      date:         inv.date,
      createdAt:    inv.createdAt ? inv.createdAt.toISOString() : null,
      customerName: inv.customerName,
      total,
      items: mapped,
    });
  }

  res.json({
    dateFrom: from,
    dateTo:   to,
    customer: customer || "",
    totalBills:      invoiceDetails.length,
    totalCustomers:  customerMap.size,
    totalItemsSold,
    totalAmount: invoiceDetails.reduce((s, i) => s + i.total, 0),
    invoices: invoiceDetails,
    itemSummary: [...itemMap.entries()]
      .map(([productName, totalQty]) => ({ productName, totalQty }))
      .sort((a, b) => b.totalQty - a.totalQty),
    customerSummary: [...customerMap.entries()]
      .map(([customerName, v]) => ({ customerName, ...v }))
      .sort((a, b) => b.totalAmount - a.totalAmount),
  });
});

/* ── Customer Receipt Report ──────────────────────────────────────────── */
router.get("/customer-receipt", async (req, res) => {
  const { customer = "", dateFrom, dateTo } = req.query as Record<string, string>;
  const from = dateFrom || new Date().toISOString().split("T")[0];
  const to   = dateTo   || new Date().toISOString().split("T")[0];

  if (!customer.trim()) {
    return res.status(400).json({ error: "customer is required" });
  }

  const invoices = await db
    .select({
      id:   invoicesTable.id,
      date: invoicesTable.date,
    })
    .from(invoicesTable)
    .where(and(
      gte(invoicesTable.date, from),
      lte(invoicesTable.date, to),
      ilike(invoicesTable.customerName, `%${customer.trim()}%`),
    ))
    .orderBy(invoicesTable.date);

  // Group by date; within each date aggregate items by productName+price
  const dateMap = new Map<string, Map<string, { productName: string; price: number; qty: number }>>();

  for (const inv of invoices) {
    const items = await db
      .select({
        productName: productsTable.name,
        qty:         invoiceItemsTable.qty,
        price:       invoiceItemsTable.price,
      })
      .from(invoiceItemsTable)
      .leftJoin(productsTable, eq(invoiceItemsTable.productId, productsTable.id))
      .where(eq(invoiceItemsTable.invoiceId, inv.id));

    if (!dateMap.has(inv.date)) dateMap.set(inv.date, new Map());
    const dayItems = dateMap.get(inv.date)!;

    for (const it of items) {
      const name  = it.productName || "Unknown";
      const price = parseFloat(it.price as any);
      const qty   = parseFloat(it.qty   as any);
      const key   = `${name}__${price}`;
      const existing = dayItems.get(key);
      if (existing) existing.qty += qty;
      else dayItems.set(key, { productName: name, price, qty });
    }
  }

  const dateGroups = [...dateMap.entries()].map(([date, itemMap]) => {
    const items = [...itemMap.values()].map(it => ({
      productName: it.productName,
      qty:         it.qty,
      price:       it.price,
      total:       it.qty * it.price,
    }));
    const dayTotal = items.reduce((s, i) => s + i.total, 0);
    return { date, items, dayTotal };
  }).sort((a, b) => a.date.localeCompare(b.date));

  const totalAmount = dateGroups.reduce((s, g) => s + g.dayTotal, 0);

  res.json({ customer: customer.trim(), dateFrom: from, dateTo: to, dateGroups, totalAmount });
});

export default router;
