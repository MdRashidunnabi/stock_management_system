import { pgEnum, pgSchema, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Drizzle pg-core helpers shared by every domain schema file.
 *
 * NOTE: SQL schema is the source of truth (see supabase/migrations/*).
 * These Drizzle definitions only mirror it for type-safe query building.
 * Do NOT generate migrations from this; create raw SQL migrations instead.
 */

export const appSchema = pgSchema("app");

// Postgres enums (must match supabase/migrations/20260517100100_init_enums.sql)
export const tenantStatus = pgEnum("tenant_status", [
  "pending",
  "trial",
  "active",
  "past_due",
  "suspended",
  "cancelled",
]);

export const userRole = pgEnum("user_role", [
  "super_admin",
  "support_admin",
  "owner",
  "manager",
  "cashier",
  "warehouse",
  "accountant",
  "delivery",
]);

export const posSessionStatus = pgEnum("pos_session_status", ["open", "closed", "force_closed"]);

export const saleChannel = pgEnum("sale_channel", ["pos", "online", "b2b", "phone"]);

export const saleStatus = pgEnum("sale_status", [
  "completed",
  "voided",
  "refunded",
  "partially_refunded",
]);

export const paymentMethod = pgEnum("payment_method", [
  "cash",
  "card",
  "contactless",
  "apple_pay",
  "google_pay",
  "revolut",
  "bank_transfer",
  "store_credit",
  "customer_account",
  "voucher",
]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "authorised",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
  "voided",
]);

export const stockState = pgEnum("stock_state", [
  "available",
  "reserved",
  "sold",
  "damaged",
  "expired",
  "in_transit",
  "returned",
  "quarantine",
]);

export const stockMovementType = pgEnum("stock_movement_type", [
  "goods_receipt",
  "pos_sale",
  "online_reserve",
  "online_release",
  "online_ship",
  "damaged",
  "expired",
  "transfer_out",
  "transfer_in",
  "return",
  "adjustment",
  "opening_balance",
  "count_correction",
]);

export const purchaseOrderStatus = pgEnum("purchase_order_status", [
  "draft",
  "submitted",
  "partially_received",
  "received",
  "cancelled",
  "closed",
]);

export const goodsReceiptStatus = pgEnum("goods_receipt_status", [
  "draft",
  "finalised",
  "cancelled",
]);

export const cashMovementType = pgEnum("cash_movement_type", [
  "opening",
  "sale",
  "refund_out",
  "cash_drop",
  "expense",
  "pay_in",
  "pay_out",
  "closing",
]);

export const vatCode = pgEnum("vat_code", ["STD", "RED", "SEC", "LIV", "ZER", "EXE"]);

// Common column shapes
export const id = uuid("id").defaultRandom().primaryKey();
export const createdAt = timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
export const updatedAt = timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();
