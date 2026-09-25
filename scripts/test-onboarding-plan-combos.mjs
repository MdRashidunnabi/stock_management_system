#!/usr/bin/env node
/**
 * Create a shop for every shop-tier × branch-tier combination against local Supabase.
 */
import { createClient } from "@supabase/supabase-js";

const SB_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const SHOP_TIERS = [1, 5, 10, 15, 20, 25, 30];
const BRANCH_TIERS = [1, 5, 10, 15, 20, 25, 30];
const PRICE_PER_SHOP = { 1: 2000, 5: 1800, 10: 1600, 15: 1500, 20: 1400, 25: 1300, 30: 1200 };
const BRANCH_ADDON = { 1: 0, 5: 500, 10: 900, 15: 1200, 20: 1500, 25: 1800, 30: 2000 };

const admin = createClient(SB_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const COUNTRIES = [
  {
    code: "PT",
    currency: "EUR",
    timezone: "Europe/Lisbon",
    locale: "pt-PT",
    vat: { STD: 0.23, RED: 0.13, SEC: 0.06, LIV: 0, ZER: 0, EXE: 0 },
  },
  {
    code: "BD",
    currency: "BDT",
    timezone: "Asia/Dhaka",
    locale: "bn-BD",
    vat: { STD: 0.15, RED: 0.075, SEC: 0.05, LIV: 0, ZER: 0, EXE: 0 },
  },
  {
    code: "IE",
    currency: "EUR",
    timezone: "Europe/Dublin",
    locale: "en-IE",
    vat: { STD: 0.23, RED: 0.135, SEC: 0.09, LIV: 0.048, ZER: 0, EXE: 0 },
  },
];

async function main() {
  const stamp = Date.now();
  const password = "TestPass123!";
  const createdUserIds = [];
  let pass = 0;
  let fail = 0;
  const failures = [];

  console.info(`Testing ${SHOP_TIERS.length * BRANCH_TIERS.length} plan combinations`);

  for (let i = 0; i < SHOP_TIERS.length; i++) {
    for (let j = 0; j < BRANCH_TIERS.length; j++) {
      const shopTier = SHOP_TIERS[i];
      const branchTier = BRANCH_TIERS[j];
      const country = COUNTRIES[(i + j) % COUNTRIES.length];
      const monthly = shopTier * PRICE_PER_SHOP[shopTier] + BRANCH_ADDON[branchTier];
      const email = `combo-${shopTier}-${branchTier}-${stamp}@shopos.test`;
      const slug = `combo-${shopTier}-${branchTier}-${stamp}`;
      const label = `shops=${shopTier} branches=${branchTier} country=${country.code}`;

      try {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: `Combo ${shopTier}/${branchTier}`, country: country.code },
        });
        if (createErr) throw createErr;
        createdUserIds.push(created.user.id);

        const userClient = createClient(SB_URL, ANON_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error: signErr } = await userClient.auth.signInWithPassword({ email, password });
        if (signErr) throw signErr;

        const { data, error } = await userClient
          .rpc("create_tenant_with_owner", {
            p_legal_name: `Combo ${shopTier} ${branchTier} Ltd`,
            p_display_name: `Combo ${shopTier}-${branchTier}`,
            p_slug: slug,
            p_vat_number: "328026476",
            p_country: country.code,
            p_currency: country.currency,
            p_timezone: country.timezone,
            p_locale: country.locale,
            p_vat_rates: country.vat,
            p_branch_code: "MAIN",
            p_branch_name: `Combo ${shopTier}-${branchTier}`,
            p_plan_shop_tier: shopTier,
            p_plan_branch_tier: branchTier,
            p_monthly_amount_cents: monthly,
          })
          .single();

        if (error) throw error;
        if (!data?.tenant_id || !data?.branch_id || !data?.slug) {
          throw new Error(`missing ids in RPC result: ${JSON.stringify(data)}`);
        }

        const { data: tenant, error: tErr } = await admin
          .from("tenants")
          .select("id, slug, country, currency, vat_rates, status, billing_account_id")
          .eq("id", data.tenant_id)
          .single();
        if (tErr) throw tErr;
        if (tenant.status !== "trial") throw new Error(`status=${tenant.status}`);
        if (tenant.country !== country.code) throw new Error(`country=${tenant.country}`);
        if (tenant.currency !== country.currency) throw new Error(`currency=${tenant.currency}`);
        const std = Number(tenant.vat_rates?.STD);
        if (std !== country.vat.STD) throw new Error(`vat STD=${std}`);

        const { data: branch, error: bErr } = await admin
          .from("branches")
          .select("id, code, tenant_id")
          .eq("id", data.branch_id)
          .single();
        if (bErr) throw bErr;
        if (branch.tenant_id !== data.tenant_id || branch.code !== "MAIN") {
          throw new Error("branch mismatch");
        }

        const { data: membership, error: mErr } = await admin
          .from("user_tenants")
          .select("role")
          .eq("tenant_id", data.tenant_id)
          .eq("user_id", created.user.id)
          .single();
        if (mErr) throw mErr;
        if (membership.role !== "owner") throw new Error(`role=${membership.role}`);

        const { data: billing, error: billErr } = await admin
          .from("billing_accounts")
          .select("plan_shop_tier, plan_branch_tier, licensed_shop_count, licensed_branch_count, monthly_amount_cents")
          .eq("id", tenant.billing_account_id)
          .single();
        if (billErr) throw billErr;
        if (Number(billing.plan_shop_tier) !== shopTier) throw new Error(`plan_shop_tier=${billing.plan_shop_tier}`);
        if (Number(billing.plan_branch_tier) !== branchTier) {
          throw new Error(`plan_branch_tier=${billing.plan_branch_tier}`);
        }
        if (Number(billing.licensed_shop_count) !== shopTier) {
          throw new Error(`licensed_shop_count=${billing.licensed_shop_count}`);
        }
        if (Number(billing.licensed_branch_count) !== branchTier) {
          throw new Error(`licensed_branch_count=${billing.licensed_branch_count}`);
        }
        if (Number(billing.monthly_amount_cents) !== monthly) {
          throw new Error(`monthly=${billing.monthly_amount_cents} expected ${monthly}`);
        }

        pass += 1;
        console.info(`  PASS  ${label} slug=${data.slug}`);
      } catch (err) {
        fail += 1;
        const why = err instanceof Error ? err.message : String(err);
        failures.push(`${label}: ${why}`);
        console.info(`  FAIL  ${label}  -  ${why}`);
      }
    }
  }

  console.info("\nCleanup test users");
  for (const id of createdUserIds) {
    await admin.from("tenants").delete().eq("created_by", id);
    await admin.from("billing_accounts").delete().eq("owner_user_id", id);
    await admin.auth.admin.deleteUser(id);
  }

  console.info(`\n${pass} passed, ${fail} failed, ${SHOP_TIERS.length * BRANCH_TIERS.length} total`);
  if (failures.length) {
    for (const f of failures) console.info(`  ${f}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
