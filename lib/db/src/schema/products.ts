import { pgTable, serial, text, numeric, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name:  text("name").notNull(),
  name2: text("name2"),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull().default("0"),
  trackStock: boolean("track_stock").notNull().default(false),
  stockQty: integer("stock_qty").notNull().default(0),
  image: text("image"),
  createdDate: text("created_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  deletedBy: text("deleted_by"),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
