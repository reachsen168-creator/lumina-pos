import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const damageRecordsTable = pgTable("damage_records", {
  id:            serial("id").primaryKey(),
  itemName:      text("item_name").notNull(),
  productId:     integer("product_id"),
  damageQty:     numeric("damage_qty", { precision: 10, scale: 2 }).notNull(),
  repairedQty:   numeric("repaired_qty", { precision: 10, scale: 2 }).notNull().default("0"),
  soldQty:       numeric("sold_qty", { precision: 10, scale: 2 }).notNull().default("0"),
  remainingQty:  numeric("remaining_qty", { precision: 10, scale: 2 }).notNull(),
  invoiceNumber: text("invoice_number"),
  customerName:  text("customer_name"),
  damageDate:    text("damage_date").notNull(),
  damageReason:  text("damage_reason"),
  status:        text("status").notNull().default("Damaged"),
  soldTo:        text("sold_to"),
  saleInvoice:   text("sale_invoice"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});

export const insertDamageRecordSchema = createInsertSchema(damageRecordsTable).omit({ id: true, createdAt: true });
export type InsertDamageRecord = z.infer<typeof insertDamageRecordSchema>;
export type DamageRecord = typeof damageRecordsTable.$inferSelect;
