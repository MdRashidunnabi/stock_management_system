"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import {
  createSupplierSchema,
  supplierIdSchema,
  updateSupplierSchema,
  type SupplierFullRow,
  type SupplierListRow,
  type supplierBaseSchema,
} from "@/lib/suppliers/schemas";

const TABLE = "suppliers";
const writableRoles = ["owner", "manager", "warehouse"] as const;

export async function listSuppliers(): Promise<SupplierListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id, code, name, contact_name, email, phone, city, county, country, payment_terms, default_lead_time_days, is_active, created_at",
    )
    .order("name", { ascending: true });
  if (error) throw new Error(`Failed to load suppliers: ${error.message}`);
  return (data ?? []) as SupplierListRow[];
}

export async function getSupplier(id: string): Promise<SupplierFullRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      `id, code, name, legal_name, vat_number, contact_name, email, phone,
       address_line1, address_line2, city, county, eircode, country,
       payment_terms, default_lead_time_days, default_currency, notes, is_active`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load supplier: ${error.message}`);
  return (data ?? null) as SupplierFullRow | null;
}

/**
 * For dropdowns on the product form. Returns active suppliers only.
 */
export async function listActiveSuppliersForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, code, name")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(`Failed to load suppliers: ${error.message}`);
  return data ?? [];
}

/* ------------------------------- Actions ------------------------------- */

export const createSupplierAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "suppliers.create" })
  .inputSchema(createSupplierSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(TABLE)
      .insert(toRow(ctx.tenant.tenantId, parsedInput))
      .select("id")
      .single();
    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/suppliers");
    revalidatePath("/products");
    return { ok: true as const, id: data.id };
  });

export const updateSupplierAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "suppliers.update" })
  .inputSchema(updateSupplierSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { id, ...rest } = parsedInput;
    const { error } = await supabase
      .from(TABLE)
      .update(toRow(ctx.tenant.tenantId, rest))
      .eq("id", id)
      .eq("tenant_id", ctx.tenant.tenantId);
    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    revalidatePath("/products");
    return { ok: true as const };
  });

export const archiveSupplierAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "suppliers.archive" })
  .inputSchema(supplierIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ is_active: false })
      .eq("id", parsedInput.id)
      .eq("tenant_id", ctx.tenant.tenantId);
    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/suppliers");
    return { ok: true as const };
  });

export const restoreSupplierAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "suppliers.restore" })
  .inputSchema(supplierIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ is_active: true })
      .eq("id", parsedInput.id)
      .eq("tenant_id", ctx.tenant.tenantId);
    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/suppliers");
    return { ok: true as const };
  });

/* ------------------------------- Helpers ------------------------------- */

function toRow(tenantId: string, input: z.output<typeof supplierBaseSchema>) {
  return {
    tenant_id: tenantId,
    code: input.code || null,
    name: input.name,
    legal_name: input.legalName || null,
    vat_number: input.vatNumber || null,
    contact_name: input.contactName || null,
    email: input.email || null,
    phone: input.phone || null,
    address_line1: input.addressLine1 || null,
    address_line2: input.addressLine2 || null,
    city: input.city || null,
    county: input.county || null,
    eircode: input.eircode || null,
    country: input.country.toUpperCase(),
    payment_terms: input.paymentTerms || null,
    default_lead_time_days: input.defaultLeadTimeDays ?? null,
    default_currency: input.defaultCurrency.toUpperCase(),
    notes: input.notes || null,
    is_active: input.isActive,
  };
}

function friendlyDbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "A supplier with that code already exists.";
  if (error.code === "42501") return "You don't have permission to modify suppliers.";
  return error.message;
}
