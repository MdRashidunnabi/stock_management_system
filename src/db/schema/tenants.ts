import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { citext } from "@/db/types/citext";
import { createdAt, id, tenantStatus, updatedAt, userRole } from "./_shared";

/**
 * Tenants - one paying customer (a shop or shop group).
 */
export const tenants = pgTable(
  "tenants",
  {
    id,
    slug: citext("slug").notNull().unique(),
    legalName: text("legal_name").notNull(),
    displayName: text("display_name").notNull(),
    vatNumber: text("vat_number"),
    country: text("country").notNull().default("IE"),
    currency: text("currency").notNull().default("EUR"),
    timezone: text("timezone").notNull().default("Europe/Dublin"),
    defaultLocale: text("default_locale").notNull().default("en-IE"),
    status: tenantStatus("status").notNull().default("trial"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt,
    updatedAt,
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [index("tenants_status_idx_d").on(t.status), index("tenants_country_idx_d").on(t.country)],
);

export const branches = pgTable(
  "branches",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isWarehouse: boolean("is_warehouse").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    county: text("county"),
    eircode: text("eircode"),
    country: text("country").notNull().default("IE"),
    phone: text("phone"),
    email: citext("email"),
    timezone: text("timezone").notNull().default("Europe/Dublin"),
    openingHours: jsonb("opening_hours"),
    createdAt,
    updatedAt,
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [
    uniqueIndex("branches_tenant_code_uq_d").on(t.tenantId, t.code),
    index("branches_tenant_idx_d").on(t.tenantId),
    index("branches_active_idx_d").on(t.tenantId, t.isActive),
  ],
);

/**
 * Profiles - 1:1 with auth.users (Supabase managed).
 * The auth.users row is created by Supabase Auth; a trigger inserts a row here.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(), // = auth.users.id
    email: citext("email").notNull(),
    fullName: text("full_name"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    locale: text("locale").notNull().default("en-IE"),
    isPlatformStaff: boolean("is_platform_staff").notNull().default(false),
    createdAt,
    updatedAt,
  },
  (t) => [index("profiles_email_idx_d").on(t.email)],
);

export const userTenants = pgTable(
  "user_tenants",
  {
    id,
    userId: uuid("user_id").notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: userRole("role").notNull(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    invitedBy: uuid("invited_by"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("user_tenants_uq_d").on(t.userId, t.tenantId, t.role, t.branchId),
    index("user_tenants_user_idx_d").on(t.userId),
    index("user_tenants_tenant_idx_d").on(t.tenantId),
  ],
);
