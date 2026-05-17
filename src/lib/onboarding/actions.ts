"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authActionClient, ActionError } from "@/lib/safe-action";
import { createTenantSchema } from "@/lib/onboarding/schemas";
import {
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
} from "@/lib/constants";
import { writeActiveTenantCookie } from "@/lib/auth/cookies";
import { getUserTenants } from "@/lib/auth/tenant";

/**
 * Create the caller's first tenant + branch + ownership in a single
 * transaction (via the SECURITY DEFINER `public.create_tenant_with_owner`
 * RPC defined in `supabase/migrations/20260517110000_*.sql`).
 *
 * Refuses if the caller already belongs to a tenant - the RPC also enforces
 * this server-side as a defence-in-depth check.
 *
 * On success: writes the active-tenant cookie and redirects to /dashboard.
 */
export const createTenantAction = authActionClient
  .metadata({ actionName: "onboarding.createTenant" })
  .inputSchema(createTenantSchema)
  .action(async ({ parsedInput }) => {
    // Belt-and-braces: if the user already has a tenant, send them on instead
    // of creating a duplicate.
    const existing = await getUserTenants();
    if (existing.length > 0) {
      redirect("/dashboard");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc("create_tenant_with_owner", {
        p_legal_name: parsedInput.legalName,
        p_display_name: parsedInput.displayName,
        p_slug: parsedInput.slug,
        p_vat_number: parsedInput.vatNumber || undefined,
        p_country: DEFAULT_COUNTRY,
        p_currency: DEFAULT_CURRENCY,
        p_timezone: DEFAULT_TIMEZONE,
        p_locale: DEFAULT_LOCALE,
        p_branch_code: parsedInput.branchCode,
        p_branch_name: parsedInput.branchName,
        p_branch_address_line1: parsedInput.branchAddressLine1 || undefined,
        p_branch_city: parsedInput.branchCity || undefined,
        p_branch_county: parsedInput.branchCounty || undefined,
        p_branch_eircode: parsedInput.branchEircode || undefined,
      })
      .single();

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[onboarding.createTenant] rpc error", error);
      }
      // The RPC raises with errcode 42501 if the caller already owns a
      // tenant or is unauthenticated. Friendlier surface for the UI.
      if (error.code === "42501") {
        throw new ActionError(
          "Your account already belongs to a shop. Try signing out and back in.",
        );
      }
      throw new ActionError("Could not create your shop. Please try again.");
    }

    if (!data?.tenant_id) {
      throw new ActionError("Shop created but no tenant id was returned. Please refresh.");
    }

    await writeActiveTenantCookie(data.tenant_id);
    revalidatePath("/", "layout");

    return {
      ok: true as const,
      tenantId: data.tenant_id,
      branchId: data.branch_id,
      slug: data.slug,
    };
  });
