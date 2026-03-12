import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { invoicesTable } from "./invoices";

export const transfersTable = pgTable("transfers", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  qty: numeric("qty", { precision: 10, scale: 2 }).notNull(),
  fromInvoiceId: integer("from_invoice_id").notNull().references(() => invoicesTable.id),
  toInvoiceId: integer("to_invoice_id").notNull().references(() => invoicesTable.id),
  date: text("date").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTransferSchema = createInsertSchema(transfersTable).omit({ id: true, createdAt: true });
export type InsertTransfer = z.infer<typeof insertTransferSchema>;
export type Transfer = typeof transfersTable.$inferSelect;
