"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { authActionClient, ActionError } from "@/lib/safe-action";
import { onboardingSetupSchema, type OnboardingSetupInput } from "@/lib/onboarding/schemas";
import { planFromCounts } from "@/lib/billing/plans";
import { getCountry } from "@/lib/geo/countries";
import { writeActiveTenantCookie } from "@/lib/auth/cookies";
import { getUserTenants } from "@/lib/auth/tenant";

type BranchIn = OnboardingSetupInput["branches"][number];

async function addMissingBranches(
  supabase: SupabaseClient,
  tenantId: string,
  shopName: string,
  branches: BranchIn[],
) {
  const { data: existingRows, error: listError } = await supabase
    .from("branches")
    .select("code")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (listError) {
    if (process.env.NODE_ENV === "development") {
      console.error("[onboarding.listBranches] error", listError);
    }
    throw new ActionError(`Could not read branches for ${shopName}.`);
  }

  const have = new Set((existingRows ?? []).map((row) => String(row.code).toUpperCase()));

  for (const branch of branches) {
    if (have.has(branch.branchCode.toUpperCase())) continue;

    const { error: branchError } = await supabase.rpc("add_branch_for_tenant", {
      p_tenant_id: tenantId,
      p_code: branch.branchCode,
      p_name: branch.branchName,
      p_address_line1: branch.branchAddressLine1 || undefined,
      p_city: branch.branchCity || undefined,
      p_county: branch.branchCounty || undefined,
      p_eircode: branch.branchEircode || undefined,
    });
    if (branchError) {
      if (process.env.NODE_ENV === "development") {
        console.error("[onboarding.addBranch] rpc error", branchError);
      }
      throw new ActionError(
        `Shop ${shopName} was created, but a branch could not be added. Open Settings to finish.`,
      );
    }
    have.add(branch.branchCode.toUpperCase());
  }
}

export const createTenantAction = authActionClient
  .metadata({ actionName: "onboarding.createTenant" })
  .inputSchema(onboardingSetupSchema)
  .action(async ({ parsedInput }) => {
    const existing = await getUserTenants();
    const existingBySlug = new Map(existing.map((t) => [t.tenantSlug, t]));

    const maxBranches = Math.max(
      1,
      ...parsedInput.shops.map(
        (shop) => parsedInput.branches.filter((b) => b.shopKey === shop.key).length,
      ),
    );
    const { shopTier, branchTier, monthlyCents } = planFromCounts(
      parsedInput.shops.length,
      maxBranches,
    );

    const supabase = await createClient();
    let firstTenantId: string | null = null;
    let firstBranchId: string | null = null;
    let firstSlug: string | null = null;

    for (const shop of parsedInput.shops) {
      const country = getCountry(shop.country);
      if (!country) {
        throw new ActionError(`Pick a valid country for ${shop.displayName}.`);
      }

      const shopBranches = parsedInput.branches.filter((b) => b.shopKey === shop.key);
      const [primary, ...extraBranches] = shopBranches;
      if (!primary) {
        throw new ActionError(`Add a branch for ${shop.displayName}.`);
      }

      const already = existingBySlug.get(shop.slug);
      if (already) {
        if (!firstTenantId) {
          firstTenantId = already.tenantId;
          firstSlug = already.tenantSlug;
          await writeActiveTenantCookie(already.tenantId);
        }
        await addMissingBranches(supabase, already.tenantId, shop.displayName, shopBranches);
        continue;
      }

      const { data, error } = await supabase
        .rpc("create_tenant_with_owner", {
          p_legal_name: shop.legalName,
          p_display_name: shop.displayName,
          p_slug: shop.slug,
          p_vat_number: shop.vatNumber || undefined,
          p_country: country.code,
          p_currency: country.currency,
          p_timezone: country.timezone,
          p_locale: country.locale,
          p_vat_rates: country.vatRates,
          p_branch_code: primary.branchCode,
          p_branch_name: primary.branchName,
          p_branch_address_line1: primary.branchAddressLine1 || undefined,
          p_branch_city: primary.branchCity || undefined,
          p_branch_county: primary.branchCounty || undefined,
          p_branch_eircode: primary.branchEircode || undefined,
          p_plan_shop_tier: shopTier,
          p_plan_branch_tier: branchTier,
          p_monthly_amount_cents: monthlyCents,
        })
        .single();

      if (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[onboarding.createTenant] rpc error", error);
        }
        if (error.code === "42501") {
          throw new ActionError(
            error.message.includes("shop limit")
              ? error.message
              : "You cannot create this shop with your current plan.",
          );
        }
        throw new ActionError(
          firstTenantId
            ? "Some shops were created, but the next one failed. Open My shops to continue."
            : "Could not create your shop. Please try again.",
        );
      }

      if (!data?.tenant_id) {
        throw new ActionError("Shop created but no tenant id was returned. Please refresh.");
      }

      if (!firstTenantId) {
        firstTenantId = data.tenant_id;
        firstBranchId = data.branch_id;
        firstSlug = data.slug;
        await writeActiveTenantCookie(data.tenant_id);
      }

      await addMissingBranches(supabase, data.tenant_id, shop.displayName, extraBranches);
    }

    if (!firstTenantId) {
      throw new ActionError("Could not create your shop. Please try again.");
    }

    revalidatePath("/", "layout");

    return {
      ok: true as const,
      tenantId: firstTenantId,
      branchId: firstBranchId,
      slug: firstSlug,
    };
  });
