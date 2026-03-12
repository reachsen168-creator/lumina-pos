import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const historyLogsTable = pgTable("history_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  description: text("description").notNull(),
  date: text("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHistoryLogSchema = createInsertSchema(historyLogsTable).omit({ id: true, createdAt: true });
export type InsertHistoryLog = z.infer<typeof insertHistoryLogSchema>;
export type HistoryLog = typeof historyLogsTable.$inferSelect;
