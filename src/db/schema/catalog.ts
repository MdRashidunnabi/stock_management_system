import {
  bigserial,
  boolean,
  date,
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
import { createdAt, id, updatedAt, vatCode } from "./_shared";

const tenantId = (name = "tenant_id") =>
  uuid(name)
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" });

export const categories = pgTable(
  "categories",
  {
    id,
    tenantId: tenantId(),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt,
    updatedAt,
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [
    uniqueIndex("categories_tenant_slug_uq_d").on(t.tenantId, t.slug),
    index("categories_tenant_idx_d").on(t.tenantId),
    index("categories_parent_idx_d").on(t.parentId),
  ],
);

export const brands = pgTable(
  "brands",
  {
    id,
    tenantId: tenantId(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logoUrl: text("logo_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt,
    updatedAt,
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [
    uniqueIndex("brands_tenant_slug_uq_d").on(t.tenantId, t.slug),
    index("brands_tenant_idx_d").on(t.tenantId),
  ],
);

export const products = pgTable(
  "products",
  {
    id,
    tenantId: tenantId(),
    name: text("name").notNull(),
    shortNameForReceipt: text("short_name_for_receipt"),
    sku: text("sku"),
    internalCode: text("internal_code"),
    barcode: text("barcode"),
    extraBarcodes: text("extra_barcodes").array().default([]),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    defaultSupplierId: uuid("default_supplier_id"),
    descriptionShort: text("description_short"),
    descriptionLong: text("description_long"),
    primaryImageUrl: text("primary_image_url"),
    images: text("images").array().default([]),
    purchasePrice: numeric("purchase_price", { precision: 14, scale: 4 }).notNull().default("0"),
    sellingPrice: numeric("selling_price", { precision: 14, scale: 4 }).notNull().default("0"),
    vatCode: vatCode("vat_code").notNull().default("STD"),
    vatIncluded: boolean("vat_included").notNull().default(true),
    marginTargetPct: numeric("margin_target_pct", { precision: 6, scale: 2 }),
    baseUnit: text("base_unit").notNull().default("un"),
    weighable: boolean("weighable").notNull().default(false),
    decimalQtyAllowed: boolean("decimal_qty_allowed").notNull().default(false),
    unitConversions: jsonb("unit_conversions").default([]),
    hasVariants: boolean("has_variants").notNull().default(false),
    batchTracking: boolean("batch_tracking").notNull().default(false),
    serialTracking: boolean("serial_tracking").notNull().default(false),
    defaultShelfLifeDays: integer("default_shelf_life_days"),
    onlineVisible: boolean("online_visible").notNull().default(false),
    onlineTitle: text("online_title"),
    onlineDescription: text("online_description"),
    seoSlug: text("seo_slug"),
    requiresAgeCheck: boolean("requires_age_check").notNull().default(false),
    hazmat: boolean("hazmat").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt,
    updatedAt,
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [
    uniqueIndex("products_tenant_sku_uq_d").on(t.tenantId, t.sku),
    uniqueIndex("products_tenant_barcode_uq_d").on(t.tenantId, t.barcode),
    uniqueIndex("products_tenant_seo_slug_uq_d").on(t.tenantId, t.seoSlug),
    index("products_tenant_idx_d").on(t.tenantId),
    index("products_category_idx_d").on(t.categoryId),
    index("products_brand_idx_d").on(t.brandId),
    index("products_active_idx_d").on(t.tenantId, t.isActive),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id,
    tenantId: tenantId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku"),
    barcode: text("barcode"),
    attributes: jsonb("attributes").notNull().default({}),
    priceOverride: numeric("price_override", { precision: 14, scale: 4 }),
    purchasePriceOverride: numeric("purchase_price_override", { precision: 14, scale: 4 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt,
    updatedAt,
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [
    uniqueIndex("product_variants_tenant_sku_uq_d").on(t.tenantId, t.sku),
    uniqueIndex("product_variants_tenant_barcode_uq_d").on(t.tenantId, t.barcode),
    index("product_variants_product_idx_d").on(t.productId),
    index("product_variants_tenant_idx_d").on(t.tenantId),
  ],
);

export const productBranchSettings = pgTable(
  "product_branch_settings",
  {
    id,
    tenantId: tenantId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    minStock: numeric("min_stock", { precision: 14, scale: 4 }).notNull().default("0"),
    maxStock: numeric("max_stock", { precision: 14, scale: 4 }),
    reorderQty: numeric("reorder_qty", { precision: 14, scale: 4 }),
    leadTimeDays: integer("lead_time_days"),
    branchPrice: numeric("branch_price", { precision: 14, scale: 4 }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("product_branch_settings_uq_d").on(t.productId, t.branchId),
    index("product_branch_settings_tenant_idx_d").on(t.tenantId),
  ],
);

export const batches = pgTable(
  "batches",
  {
    id,
    tenantId: tenantId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    lotNo: text("lot_no").notNull(),
    manufactureDate: date("manufacture_date"),
    expiryDate: date("expiry_date"),
    notes: text("notes"),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("batches_product_lot_uq_d").on(t.productId, t.lotNo),
    index("batches_tenant_idx_d").on(t.tenantId),
    index("batches_product_idx_d").on(t.productId),
  ],
);

export const productPriceHistory = pgTable(
  "product_price_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: tenantId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    oldValue: numeric("old_value", { precision: 14, scale: 4 }),
    newValue: numeric("new_value", { precision: 14, scale: 4 }),
    changedBy: uuid("changed_by"),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("product_price_history_product_idx_d").on(t.productId, t.changedAt)],
);
