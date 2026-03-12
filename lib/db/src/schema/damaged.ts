import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { invoicesTable } from "./invoices";

export const damagedItemsTable = pgTable("damaged_items", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  qty: integer("qty").notNull(),
  invoiceId: integer("invoice_id").references(() => invoicesTable.id, { onDelete: "set null" }),
  customerName: text("customer_name"),
  damageReason: text("damage_reason"),
  date: text("date").notNull(),
  status: text("status").notNull().default("Damaged"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDamagedItemSchema = createInsertSchema(damagedItemsTable).omit({ id: true, createdAt: true });
export type InsertDamagedItem = z.infer<typeof insertDamagedItemSchema>;
export type DamagedItem = typeof damagedItemsTable.$inferSelect;
