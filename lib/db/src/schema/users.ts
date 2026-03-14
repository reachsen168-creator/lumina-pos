import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id:           serial("id").primaryKey(),
  username:     varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role:         varchar("role", { length: 32 }).notNull().default("staff"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});
