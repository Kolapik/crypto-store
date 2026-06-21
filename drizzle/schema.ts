import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Watches ───────────────────────────────────────────────────────────────

export const watches = mysqlTable("watches", {
  id: int("id").autoincrement().primaryKey(),
  brand: varchar("brand", { length: 128 }).notNull(),
  model: varchar("model", { length: 256 }).notNull(),
  reference: varchar("reference", { length: 128 }),
  year: int("year"),
  condition: mysqlEnum("condition", ["unworn", "excellent", "very_good", "good", "fair"]).default("excellent"),
  price: decimal("price", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 8 }).default("CHF"),
  status: mysqlEnum("status", ["available", "reserved", "sold", "hidden"]).default("available").notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  privateSource: text("privateSource"),
  slug: varchar("slug", { length: 256 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Watch = typeof watches.$inferSelect;
export type InsertWatch = typeof watches.$inferInsert;

// ─── Purchase Requests ─────────────────────────────────────────────────────

export const purchaseRequests = mysqlTable("purchase_requests", {
  id: int("id").autoincrement().primaryKey(),
  watchId: int("watchId").notNull(),
  customerName: varchar("customerName", { length: 256 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 64 }),
  cryptoPreference: mysqlEnum("cryptoPreference", ["btc", "eth", "usdt", "none", "other"]).default("none"),
  message: text("message"),
  status: mysqlEnum("status", ["new", "reviewing", "confirmed", "declined", "completed"]).default("new").notNull(),
  adminNotes: text("adminNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type InsertPurchaseRequest = typeof purchaseRequests.$inferInsert;
