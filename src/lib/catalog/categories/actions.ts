"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { slugify } from "@/lib/utils";
import {
  archiveCategorySchema,
  createCategorySchema,
  updateCategorySchema,
  type CategoryRow,
} from "@/lib/catalog/categories/schemas";

const TABLE = "categories";
const writableRoles = ["owner", "manager"] as const;

/**
 * Read every category for the active tenant. RLS keeps this scoped to the
 * caller's tenant automatically.
 */
export async function listCategories(): Promise<CategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, name, slug, position, is_active, created_at, updated_at")
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load categories: ${error.message}`);
  }
  return (data ?? []) as CategoryRow[];
}

/* ------------------------------- Actions ------------------------------- */

export const createCategoryAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "categories.create" })
  .inputSchema(createCategorySchema)
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
        position: parsedInput.position ?? 0,
      })
      .select("id, name, slug")
      .single();

    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/categories");
    revalidatePath("/products");
    return { ok: true as const, category: data };
  });

export const updateCategoryAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "categories.update" })
  .inputSchema(updateCategorySchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from(TABLE)
      .update({
        name: parsedInput.name,
        slug: parsedInput.slug,
        position: parsedInput.position,
        is_active: parsedInput.isActive,
      })
      .eq("id", parsedInput.id)
      .eq("tenant_id", ctx.tenant.tenantId);
    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/categories");
    revalidatePath("/products");
    return { ok: true as const };
  });

export const archiveCategoryAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "categories.archive" })
  .inputSchema(archiveCategorySchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ is_active: false })
      .eq("id", parsedInput.id)
      .eq("tenant_id", ctx.tenant.tenantId);
    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/categories");
    revalidatePath("/products");
    return { ok: true as const };
  });

export const restoreCategoryAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "categories.restore" })
  .inputSchema(archiveCategorySchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ is_active: true })
      .eq("id", parsedInput.id)
      .eq("tenant_id", ctx.tenant.tenantId);
    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/categories");
    revalidatePath("/products");
    return { ok: true as const };
  });

/* ------------------------------- Helpers ------------------------------- */

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
      throw new ActionError(`Could not validate category slug: ${error.message}`);
    }
    if (!data) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
  throw new ActionError("Could not generate a unique slug. Pick a different name.");
}

function friendlyDbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "A category with that slug already exists.";
  if (error.code === "42501") return "You don't have permission to modify categories.";
  return error.message;
}
