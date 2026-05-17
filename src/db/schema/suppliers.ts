import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { citext } from "@/db/types/citext";
import { branches, tenants } from "./tenants";
import { products, productVariants, batches } from "./catalog";
import {
  createdAt,
  goodsReceiptStatus,
  id,
  purchaseOrderStatus,
  updatedAt,
  vatCode,
} from "./_shared";

const tenantId = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" });

export const suppliers = pgTable(
  "suppliers",
  {
    id,
    tenantId: tenantId(),
    code: text("code"),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    vatNumber: text("vat_number"),
    contactName: text("contact_name"),
    email: citext("email"),
    phone: text("phone"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    county: text("county"),
    eircode: text("eircode"),
    country: text("country").notNull().default("IE"),
    paymentTerms: text("payment_terms"),
    defaultLeadTimeDays: integer("default_lead_time_days").default(7),
    defaultCurrency: text("default_currency").notNull().default("EUR"),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdAt,
    updatedAt,
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [
    uniqueIndex("suppliers_tenant_code_uq_d").on(t.tenantId, t.code),
    index("suppliers_tenant_idx_d").on(t.tenantId),
    index("suppliers_active_idx_d").on(t.tenantId, t.isActive),
  ],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id,
    tenantId: tenantId(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    poNumber: text("po_number").notNull(),
    status: purchaseOrderStatus("status").notNull().default("draft"),
    orderedAt: timestamp("ordered_at", { withTimezone: true }),
    expectedAt: timestamp("expected_at", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    subtotal: numeric("subtotal", { precision: 14, scale: 4 }).notNull().default("0"),
    vatTotal: numeric("vat_total", { precision: 14, scale: 4 }).notNull().default("0"),
    total: numeric("total", { precision: 14, scale: 4 }).notNull().default("0"),
    currency: text("currency").notNull().default("EUR"),
    createdAt,
    updatedAt,
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("po_tenant_number_uq_d").on(t.tenantId, t.poNumber),
    index("po_tenant_idx_d").on(t.tenantId),
    index("po_branch_idx_d").on(t.branchId),
    index("po_supplier_idx_d").on(t.supplierId),
    index("po_status_idx_d").on(t.tenantId, t.status),
  ],
);

export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    id,
    tenantId: tenantId(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 14, scale: 4 }).notNull(),
    vatCode: vatCode("vat_code").notNull().default("STD"),
    notes: text("notes"),
    qtyReceived: numeric("qty_received", { precision: 14, scale: 4 }).notNull().default("0"),
    position: integer("position").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("po_items_po_idx_d").on(t.purchaseOrderId),
    index("po_items_product_idx_d").on(t.productId),
  ],
);

export const goodsReceipts = pgTable(
  "goods_receipts",
  {
    id,
    tenantId: tenantId(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, {
      onDelete: "set null",
    }),
    grNumber: text("gr_number").notNull(),
    status: goodsReceiptStatus("status").notNull().default("draft"),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    invoiceNumber: text("invoice_number"),
    invoiceTotal: numeric("invoice_total", { precision: 14, scale: 4 }),
    invoiceUrl: text("invoice_url"),
    notes: text("notes"),
    createdAt,
    updatedAt,
    createdBy: uuid("created_by"),
    finalisedAt: timestamp("finalised_at", { withTimezone: true }),
    finalisedBy: uuid("finalised_by"),
  },
  (t) => [
    uniqueIndex("gr_tenant_number_uq_d").on(t.tenantId, t.grNumber),
    index("gr_tenant_idx_d").on(t.tenantId),
    index("gr_branch_idx_d").on(t.branchId),
    index("gr_supplier_idx_d").on(t.supplierId),
    index("gr_po_idx_d").on(t.purchaseOrderId),
  ],
);

export const goodsReceiptItems = pgTable(
  "goods_receipt_items",
  {
    id,
    tenantId: tenantId(),
    goodsReceiptId: uuid("goods_receipt_id")
      .notNull()
      .references(() => goodsReceipts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 14, scale: 4 }).notNull(),
    vatCode: vatCode("vat_code").notNull().default("STD"),
    expiryDate: timestamp("expiry_date", { withTimezone: true, mode: "date" }),
    lotNo: text("lot_no"),
    notes: text("notes"),
    position: integer("position").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("gr_items_gr_idx_d").on(t.goodsReceiptId),
    index("gr_items_product_idx_d").on(t.productId),
  ],
);
