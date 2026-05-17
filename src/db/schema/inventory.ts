import {
  bigint,
  bigserial,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { branches, tenants } from "./tenants";
import { products, productVariants, batches } from "./catalog";
import { createdAt, id, stockMovementType, stockState, updatedAt } from "./_shared";

const tenantId = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" });

export const stockLedger = pgTable(
  "stock_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: tenantId(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),
    movementType: stockMovementType("movement_type").notNull(),
    fromState: stockState("from_state"),
    toState: stockState("to_state"),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 14, scale: 4 }),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    relatedMovementId: bigint("related_movement_id", { mode: "number" }),
    note: text("note"),
    userId: uuid("user_id"),
    createdAt,
  },
  (t) => [
    index("stock_ledger_tenant_idx_d").on(t.tenantId),
    index("stock_ledger_product_idx_d").on(t.tenantId, t.productId, t.branchId, t.createdAt),
    index("stock_ledger_branch_idx_d").on(t.branchId, t.createdAt),
    index("stock_ledger_reference_idx_d").on(t.referenceType, t.referenceId),
  ],
);

export const stockBalances = pgTable(
  "stock_balances",
  {
    id,
    tenantId: tenantId(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    state: stockState("state").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull().default("0"),
    updatedAt,
  },
  (t) => [
    uniqueIndex("stock_balances_uq_d").on(
      t.tenantId,
      t.branchId,
      t.productId,
      t.variantId,
      t.state,
    ),
    index("stock_balances_lookup_idx_d").on(t.tenantId, t.productId, t.branchId, t.state),
  ],
);

export const stockAdjustments = pgTable(
  "stock_adjustments",
  {
    id,
    tenantId: tenantId(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    state: stockState("state").notNull().default("available"),
    delta: numeric("delta", { precision: 14, scale: 4 }).notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("pending"),
    requestedBy: uuid("requested_by"),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    appliedLedgerId: bigint("applied_ledger_id", { mode: "number" }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("stock_adjustments_tenant_idx_d").on(t.tenantId),
    index("stock_adjustments_branch_idx_d").on(t.branchId),
    index("stock_adjustments_status_idx_d").on(t.tenantId, t.status),
  ],
);
