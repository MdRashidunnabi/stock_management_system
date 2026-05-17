import {
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
import { branches, tenants } from "./tenants";
import { products, productVariants, batches } from "./catalog";
import {
  cashMovementType,
  createdAt,
  id,
  paymentMethod,
  paymentStatus,
  posSessionStatus,
  saleChannel,
  saleStatus,
  updatedAt,
  vatCode,
} from "./_shared";

const tenantId = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" });

export const posTerminals = pgTable(
  "pos_terminals",
  {
    id,
    tenantId: tenantId(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    printerConfig: jsonb("printer_config").default({}),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("pos_terminals_branch_code_uq_d").on(t.branchId, t.code),
    index("pos_terminals_tenant_idx_d").on(t.tenantId),
  ],
);

export const posSessions = pgTable(
  "pos_sessions",
  {
    id,
    tenantId: tenantId(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    terminalId: uuid("terminal_id").references(() => posTerminals.id, { onDelete: "set null" }),
    cashierId: uuid("cashier_id").notNull(),
    status: posSessionStatus("status").notNull().default("open"),
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    openingCash: numeric("opening_cash", { precision: 14, scale: 4 }).notNull().default("0"),
    expectedCash: numeric("expected_cash", { precision: 14, scale: 4 }),
    countedCash: numeric("counted_cash", { precision: 14, scale: 4 }),
    closingNote: text("closing_note"),
    closedBy: uuid("closed_by"),
    managerPinUsed: boolean("manager_pin_used").notNull().default(false),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("pos_sessions_tenant_idx_d").on(t.tenantId),
    index("pos_sessions_branch_idx_d").on(t.branchId),
    index("pos_sessions_status_idx_d").on(t.tenantId, t.status),
  ],
);

export const cashDrawerMovements = pgTable(
  "cash_drawer_movements",
  {
    id,
    tenantId: tenantId(),
    posSessionId: uuid("pos_session_id")
      .notNull()
      .references(() => posSessions.id, { onDelete: "cascade" }),
    type: cashMovementType("type").notNull(),
    amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
    reason: text("reason"),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    userId: uuid("user_id"),
    createdAt,
  },
  (t) => [
    index("cash_movements_session_idx_d").on(t.posSessionId),
    index("cash_movements_tenant_idx_d").on(t.tenantId),
  ],
);

export const sales = pgTable(
  "sales",
  {
    id,
    tenantId: tenantId(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    posSessionId: uuid("pos_session_id").references(() => posSessions.id, { onDelete: "set null" }),
    terminalId: uuid("terminal_id").references(() => posTerminals.id, { onDelete: "set null" }),
    cashierId: uuid("cashier_id"),
    customerId: uuid("customer_id"),
    channel: saleChannel("channel").notNull().default("pos"),
    status: saleStatus("status").notNull().default("completed"),
    receiptNumber: text("receipt_number").notNull(),
    subtotal: numeric("subtotal", { precision: 14, scale: 4 }).notNull().default("0"),
    discountTotal: numeric("discount_total", { precision: 14, scale: 4 }).notNull().default("0"),
    vatTotal: numeric("vat_total", { precision: 14, scale: 4 }).notNull().default("0"),
    total: numeric("total", { precision: 14, scale: 4 }).notNull().default("0"),
    rounding: numeric("rounding", { precision: 14, scale: 4 }).notNull().default("0"),
    vatBreakdown: jsonb("vat_breakdown").notNull().default({}),
    notes: text("notes"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by"),
    voidReason: text("void_reason"),
    createdAt,
    updatedAt,
    createdBy: uuid("created_by"),
  },
  (t) => [
    uniqueIndex("sales_tenant_receipt_uq_d").on(t.tenantId, t.receiptNumber),
    index("sales_tenant_idx_d").on(t.tenantId),
    index("sales_branch_idx_d").on(t.branchId),
    index("sales_session_idx_d").on(t.posSessionId),
    index("sales_customer_idx_d").on(t.customerId),
    index("sales_created_idx_d").on(t.tenantId, t.branchId, t.createdAt),
    index("sales_status_idx_d").on(t.tenantId, t.status),
  ],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id,
    tenantId: tenantId(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    nameSnapshot: text("name_snapshot").notNull(),
    skuSnapshot: text("sku_snapshot"),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 4 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 14, scale: 4 }),
    vatCode: vatCode("vat_code").notNull().default("STD"),
    vatRate: numeric("vat_rate", { precision: 6, scale: 4 }).notNull().default("0.23"),
    discount: numeric("discount", { precision: 14, scale: 4 }).notNull().default("0"),
    lineTotalGross: numeric("line_total_gross", { precision: 14, scale: 4 }).notNull(),
    lineTotalNet: numeric("line_total_net", { precision: 14, scale: 4 }).notNull(),
    lineVat: numeric("line_vat", { precision: 14, scale: 4 }).notNull(),
    notes: text("notes"),
    createdAt,
  },
  (t) => [
    index("sale_items_sale_idx_d").on(t.saleId),
    index("sale_items_product_idx_d").on(t.tenantId, t.productId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id,
    tenantId: tenantId(),
    saleId: uuid("sale_id").references(() => sales.id, { onDelete: "cascade" }),
    onlineOrderId: uuid("online_order_id"),
    method: paymentMethod("method").notNull(),
    amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
    status: paymentStatus("status").notNull().default("captured"),
    externalRef: text("external_ref"),
    cardBrand: text("card_brand"),
    cardLast4: text("card_last4"),
    fee: numeric("fee", { precision: 14, scale: 4 }),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    refundedAmount: numeric("refunded_amount", { precision: 14, scale: 4 }).notNull().default("0"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
    createdAt,
    updatedAt,
    createdBy: uuid("created_by"),
  },
  (t) => [
    index("payments_tenant_idx_d").on(t.tenantId),
    index("payments_sale_idx_d").on(t.saleId),
    index("payments_status_idx_d").on(t.tenantId, t.status),
    index("payments_method_idx_d").on(t.tenantId, t.method),
  ],
);

export const discounts = pgTable(
  "discounts",
  {
    id,
    tenantId: tenantId(),
    code: text("code"),
    name: text("name").notNull(),
    type: text("type").notNull(),
    value: numeric("value", { precision: 14, scale: 4 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("discounts_tenant_code_uq_d").on(t.tenantId, t.code),
    index("discounts_tenant_idx_d").on(t.tenantId),
  ],
);
