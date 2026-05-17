"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { slugify } from "@/lib/utils";
import {
  createBrandSchema,
  toggleBrandSchema,
  updateBrandSchema,
  type BrandRow,
} from "@/lib/catalog/brands/schemas";

const TABLE = "brands";
const writableRoles = ["owner", "manager"] as const;

export async function listBrands(): Promise<BrandRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, name, slug, is_active, created_at, updated_at")
    .order("name", { ascending: true });
  if (error) throw new Error(`Failed to load brands: ${error.message}`);
  return (data ?? []) as BrandRow[];
}

export const createBrandAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "brands.create" })
  .inputSchema(createBrandSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const desiredSlug =
      parsedInput.slug && parsedInput.slug.length > 0
        ? parsedInput.slug
        : slugify(parsedInput.name);

    if (!desiredSlug || desiredSlug.length < 2) {
      throw new ActionError("Slug must be at least 2 characters.");
    }

    const finalSlug = await pickAvailableSlug(supabase, ctx.tenant.tenantId, desiredSlug);

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        tenant_id: ctx.tenant.tenantId,
        name: parsedInput.name,
        slug: finalSlug,
      })
      .select("id, name, slug")
      .single();

    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/brands");
    revalidatePath("/products");
    return { ok: true as const, brand: data };
  });

export const updateBrandAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "brands.update" })
  .inputSchema(updateBrandSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from(TABLE)
      .update({
        name: parsedInput.name,
        slug: parsedInput.slug,
        is_active: parsedInput.isActive,
      })
      .eq("id", parsedInput.id)
      .eq("tenant_id", ctx.tenant.tenantId);
    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/brands");
    revalidatePath("/products");
    return { ok: true as const };
  });

export const archiveBrandAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "brands.archive" })
  .inputSchema(toggleBrandSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ is_active: false })
      .eq("id", parsedInput.id)
      .eq("tenant_id", ctx.tenant.tenantId);
    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/brands");
    revalidatePath("/products");
    return { ok: true as const };
  });

export const restoreBrandAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "brands.restore" })
  .inputSchema(toggleBrandSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ is_active: true })
      .eq("id", parsedInput.id)
      .eq("tenant_id", ctx.tenant.tenantId);
    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/brands");
    revalidatePath("/products");
    return { ok: true as const };
  });

async function pickAvailableSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  base: string,
): Promise<string> {
  let candidate = base;
  for (let n = 1; n < 100; n += 1) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("slug", candidate)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      throw new ActionError(`Could not validate brand slug: ${error.message}`);
    }
    if (!data) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
  throw new ActionError("Could not generate a unique slug. Pick a different name.");
}

function friendlyDbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "A brand with that slug already exists.";
  if (error.code === "42501") return "You don't have permission to modify brands.";
  return error.message;
}
