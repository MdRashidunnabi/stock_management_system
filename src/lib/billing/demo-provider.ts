import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { DemoCardInput } from "@/lib/billing/types";

function sanitizeCard(card: DemoCardInput) {
  const digits = card.cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) {
    throw new Error("Enter a valid card number (demo mode accepts any test number).");
  }
  const last4 = digits.slice(-4);
  const brand = digits.startsWith("4") ? "visa" : digits.startsWith("5") ? "mastercard" : "card";
  return { last4, brand };
}

async function billingAccountIdForTenant(tenantId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("billing_account_id")
    .eq("id", tenantId)
    .maybeSingle();
  return data?.billing_account_id ?? null;
}

export async function demoAttachCard(tenantId: string, card: DemoCardInput) {
  const { last4, brand } = sanitizeCard(card);
  const admin = createAdminClient();

  const cardPatch = {
    card_on_file: true,
    card_last4: last4,
    card_brand: brand,
    provider: "demo" as const,
  };

  const { error: bErr } = await admin
    .from("tenant_billing")
    .update(cardPatch)
    .eq("tenant_id", tenantId);
  if (bErr) throw new Error(bErr.message);

  const accountId = await billingAccountIdForTenant(tenantId);
  if (accountId) {
    const { error: aErr } = await admin
      .from("billing_accounts")
      .update(cardPatch)
      .eq("id", accountId);
    if (aErr) throw new Error(aErr.message);
  }
}

export async function demoActivate(tenantId: string) {
  const admin = createAdminClient();
  const next = new Date();
  next.setMonth(next.getMonth() + 1);

  await admin
    .from("tenants")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", tenantId);

  await admin
    .from("tenant_billing")
    .update({
      next_billing_at: next.toISOString(),
      last_payment_at: new Date().toISOString(),
      last_payment_status: "paid",
    })
    .eq("tenant_id", tenantId);
}

export async function demoPay(tenantId: string) {
  const admin = createAdminClient();
  const next = new Date();
  next.setMonth(next.getMonth() + 1);

  await admin.from("tenants").update({ status: "active" }).eq("id", tenantId);

  await admin
    .from("tenant_billing")
    .update({
      next_billing_at: next.toISOString(),
      last_payment_at: new Date().toISOString(),
      last_payment_status: "paid",
    })
    .eq("tenant_id", tenantId);
}

export async function demoPastDue(tenantId: string) {
  const admin = createAdminClient();
  await admin.from("tenants").update({ status: "past_due" }).eq("id", tenantId);
  await admin
    .from("tenant_billing")
    .update({ last_payment_status: "failed" })
    .eq("tenant_id", tenantId);
}

export async function demoSuspend(tenantId: string) {
  const admin = createAdminClient();
  await admin.from("tenants").update({ status: "suspended" }).eq("id", tenantId);
}

export async function demoCancel(tenantId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin.from("tenants").update({ status: "cancelled" }).eq("id", tenantId);
  await admin.from("tenant_billing").update({ canceled_at: now }).eq("tenant_id", tenantId);
}

export async function demoExtendTrial(tenantId: string, days: number) {
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("trial_ends_at")
    .eq("id", tenantId)
    .maybeSingle();

  const base = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : new Date();
  if (base.getTime() < Date.now()) base.setTime(Date.now());
  base.setDate(base.getDate() + days);

  await admin
    .from("tenants")
    .update({ status: "trial", trial_ends_at: base.toISOString() })
    .eq("id", tenantId);

  await admin
    .from("tenant_billing")
    .update({ next_billing_at: base.toISOString() })
    .eq("tenant_id", tenantId);
}
