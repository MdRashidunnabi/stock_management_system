import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ShopTier, BranchTier } from "@/lib/billing/plans";

export type BillingAccountRow = {
  id: string;
  ownerUserId: string;
  planShopTier: ShopTier;
  planBranchTier: BranchTier;
  licensedShopCount: number;
  licensedBranchCount: number;
  monthlyAmountCents: number;
  currency: string;
  provider: string;
  cardOnFile: boolean;
  cardLast4: string | null;
  cardBrand: string | null;
};

function mapAccount(row: {
  id: string;
  owner_user_id: string;
  plan_shop_tier: number;
  plan_branch_tier: number;
  licensed_shop_count: number;
  licensed_branch_count: number;
  monthly_amount_cents: number;
  currency: string;
  provider: string;
  card_on_file: boolean;
  card_last4: string | null;
  card_brand: string | null;
}): BillingAccountRow {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    planShopTier: row.plan_shop_tier as ShopTier,
    planBranchTier: row.plan_branch_tier as BranchTier,
    licensedShopCount: row.licensed_shop_count,
    licensedBranchCount: row.licensed_branch_count,
    monthlyAmountCents: row.monthly_amount_cents,
    currency: row.currency,
    provider: row.provider,
    cardOnFile: row.card_on_file,
    cardLast4: row.card_last4,
    cardBrand: row.card_brand,
  };
}

export async function getBillingAccountForTenant(
  tenantId: string,
): Promise<BillingAccountRow | null> {
  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("billing_account_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant?.billing_account_id) return null;

  const { data, error } = await supabase
    .from("billing_accounts")
    .select(
      "id, owner_user_id, plan_shop_tier, plan_branch_tier, licensed_shop_count, licensed_branch_count, monthly_amount_cents, currency, provider, card_on_file, card_last4, card_brand",
    )
    .eq("id", tenant.billing_account_id)
    .maybeSingle();

  if (error || !data) return null;
  return mapAccount(data);
}

export async function getBillingAccountForOwner(userId: string): Promise<BillingAccountRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_accounts")
    .select(
      "id, owner_user_id, plan_shop_tier, plan_branch_tier, licensed_shop_count, licensed_branch_count, monthly_amount_cents, currency, provider, card_on_file, card_last4, card_brand",
    )
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapAccount(data);
}

export async function countOwnerShops(ownerUserId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("tenants")
    .select("id", { count: "exact", head: true })
    .eq("billing_accounts.owner_user_id", ownerUserId);

  if (error) {
    const { data: ba } = await admin
      .from("billing_accounts")
      .select("id")
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();
    if (!ba) return 0;
    const { count: c2 } = await admin
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("billing_account_id", ba.id);
    return c2 ?? 0;
  }
  return count ?? 0;
}

export async function listOwnerShops(ownerUserId: string) {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("user_tenants")
    .select(
      "tenant_id, role, tenants:tenant_id ( id, slug, display_name, status, billing_account_id )",
    )
    .eq("user_id", ownerUserId)
    .eq("role", "owner")
    .eq("is_active", true);

  return (memberships ?? [])
    .map((m) => {
      const t = Array.isArray(m.tenants) ? m.tenants[0] : m.tenants;
      if (!t) return null;
      return {
        tenantId: t.id as string,
        slug: t.slug as string,
        displayName: t.display_name as string,
        status: t.status as string,
      };
    })
    .filter(Boolean) as Array<{
    tenantId: string;
    slug: string;
    displayName: string;
    status: string;
  }>;
}
