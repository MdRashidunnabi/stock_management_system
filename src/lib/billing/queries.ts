import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getBillingAccountForTenant } from "@/lib/billing/account-queries";
import { resolveSubscriptionAccess } from "@/lib/billing/access";
import type { SubscriptionAccess, TenantBillingRow } from "@/lib/billing/types";
import { isPlatformStaff } from "@/lib/platform/auth";

function mapBilling(row: {
  tenant_id: string;
  provider: string;
  plan_code: string;
  monthly_amount_cents: number;
  currency: string;
  card_on_file: boolean;
  card_last4: string | null;
  card_brand: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  next_billing_at: string | null;
  last_payment_at: string | null;
  last_payment_status: string | null;
  canceled_at: string | null;
}): TenantBillingRow {
  return {
    tenantId: row.tenant_id,
    provider: row.provider as TenantBillingRow["provider"],
    planCode: row.plan_code,
    monthlyAmountCents: row.monthly_amount_cents,
    currency: row.currency,
    cardOnFile: row.card_on_file,
    cardLast4: row.card_last4,
    cardBrand: row.card_brand,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    nextBillingAt: row.next_billing_at,
    lastPaymentAt: row.last_payment_at,
    lastPaymentStatus: row.last_payment_status,
    canceledAt: row.canceled_at,
  };
}

export async function getTenantBilling(tenantId: string): Promise<TenantBillingRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_billing")
    .select(
      "tenant_id, provider, plan_code, monthly_amount_cents, currency, card_on_file, card_last4, card_brand, stripe_customer_id, stripe_subscription_id, next_billing_at, last_payment_at, last_payment_status, canceled_at",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !data) return null;
  return mapBilling(data);
}

export async function getTenantSubscriptionAccess(
  tenantId: string,
): Promise<SubscriptionAccess | null> {
  const supabase = await createClient();
  const platform = await isPlatformStaff();

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("status, trial_ends_at")
    .eq("id", tenantId)
    .maybeSingle();

  if (error || !tenant) return null;

  const [billing, account] = await Promise.all([
    getTenantBilling(tenantId),
    getBillingAccountForTenant(tenantId),
  ]);
  const monthlyAmountCents = account?.monthlyAmountCents ?? billing?.monthlyAmountCents ?? 2000;
  const cardOnFile = account?.cardOnFile ?? billing?.cardOnFile ?? false;

  return resolveSubscriptionAccess({
    status: tenant.status,
    trialEndsAt: tenant.trial_ends_at,
    cardOnFile,
    monthlyAmountCents,
    isPlatformOverride: platform,
  });
}

export interface PlatformTenantRow {
  id: string;
  slug: string;
  displayName: string;
  legalName: string;
  status: string;
  trialEndsAt: string | null;
  createdAt: string;
  billing: TenantBillingRow | null;
  memberCount: number;
}

export async function listAllTenantsForPlatform(): Promise<PlatformTenantRow[]> {
  const admin = createAdminClient();

  const { data: tenants, error } = await admin
    .from("tenants")
    .select("id, slug, display_name, legal_name, status, trial_ends_at, created_at")
    .order("created_at", { ascending: false });

  if (error || !tenants?.length) return [];

  const ids = tenants.map((t) => t.id);

  const [{ data: billings }, { data: members }] = await Promise.all([
    admin.from("tenant_billing").select("*").in("tenant_id", ids),
    admin.from("user_tenants").select("tenant_id").eq("is_active", true).in("tenant_id", ids),
  ]);

  const billingByTenant = new Map(
    (billings ?? []).map((b) => [b.tenant_id, mapBilling(b as Parameters<typeof mapBilling>[0])]),
  );
  const countByTenant = new Map<string, number>();
  for (const m of members ?? []) {
    countByTenant.set(m.tenant_id, (countByTenant.get(m.tenant_id) ?? 0) + 1);
  }

  return tenants.map((t) => ({
    id: t.id,
    slug: t.slug,
    displayName: t.display_name,
    legalName: t.legal_name,
    status: t.status,
    trialEndsAt: t.trial_ends_at,
    createdAt: t.created_at,
    billing: billingByTenant.get(t.id) ?? null,
    memberCount: countByTenant.get(t.id) ?? 0,
  }));
}

export async function getPlatformTenantDetail(tenantId: string) {
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, slug, display_name, legal_name, status, trial_ends_at, created_at, vat_number")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return null;

  const { data: billing } = await admin
    .from("tenant_billing")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const { data: userRows } = await admin
    .from("user_tenants")
    .select("user_id, role, is_active, invited_at, accepted_at")
    .eq("tenant_id", tenantId)
    .order("created_at");

  const userIds = (userRows ?? []).map((u) => u.user_id);
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const members = (userRows ?? []).map((u) => ({
    ...u,
    email: profileById.get(u.user_id)?.email ?? null,
    full_name: profileById.get(u.user_id)?.full_name ?? null,
  }));

  return {
    tenant,
    billing: billing ? mapBilling(billing as Parameters<typeof mapBilling>[0]) : null,
    members,
  };
}
