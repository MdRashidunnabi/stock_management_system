import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { citext } from "@/db/types/citext";
import { tenants } from "./tenants";
import { createdAt, id, updatedAt } from "./_shared";

const tenantId = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" });

export const customers = pgTable(
  "customers",
  {
    id,
    tenantId: tenantId(),
    code: text("code"),
    fullName: text("full_name").notNull(),
    email: citext("email"),
    phone: text("phone"),
    vatNumber: text("vat_number"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    county: text("county"),
    eircode: text("eircode"),
    country: text("country").notNull().default("IE"),
    notes: text("notes"),
    marketingOptin: boolean("marketing_optin").notNull().default(false),
    isB2b: boolean("is_b2b").notNull().default(false),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 4 }).notNull().default("0"),
    creditBalance: numeric("credit_balance", { precision: 14, scale: 4 }).notNull().default("0"),
    loyaltyBalance: numeric("loyalty_balance", { precision: 14, scale: 4 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt,
    updatedAt,
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [
    uniqueIndex("customers_tenant_code_uq_d").on(t.tenantId, t.code),
    uniqueIndex("customers_tenant_email_uq_d").on(t.tenantId, t.email),
    index("customers_tenant_idx_d").on(t.tenantId),
    index("customers_phone_idx_d").on(t.tenantId, t.phone),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt,
  },
  (t) => [
    index("audit_logs_tenant_idx_d").on(t.tenantId, t.createdAt),
    index("audit_logs_user_idx_d").on(t.userId, t.createdAt),
    index("audit_logs_entity_idx_d").on(t.tenantId, t.entityType, t.entityId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id,
    tenantId: tenantId(),
    userId: uuid("user_id"),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    data: jsonb("data").default({}),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt,
  },
  (t) => [
    index("notifications_user_idx_d").on(t.userId, t.isRead, t.createdAt),
    index("notifications_tenant_idx_d").on(t.tenantId, t.createdAt),
  ],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    key: text("key").primaryKey(),
    tenantId: tenantId(),
    userId: uuid("user_id"),
    requestHash: text("request_hash"),
    responseBody: jsonb("response_body"),
    statusCode: integer("status_code"),
    createdAt,
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("idempotency_keys_tenant_idx_d").on(t.tenantId),
    index("idempotency_keys_expires_idx_d").on(t.expiresAt),
  ],
);

export const outbox = pgTable(
  "outbox",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
    lastError: text("last_error"),
    createdAt,
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("outbox_status_idx_d").on(t.status, t.nextAttemptAt)],
);
