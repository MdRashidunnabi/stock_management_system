#!/usr/bin/env node
/**
 * Live end-to-end test of the Step 6 onboarding RPC against the local
 * Supabase stack (http://127.0.0.1:54321).
 *
 * Verifies, in order:
 *   1. A brand-new auth user is created via the admin API (and confirmed).
 *   2. That user calls public.create_tenant_with_owner via supabase-js .rpc().
 *   3. The RPC returns (tenant_id, branch_id, slug).
 *   4. The corresponding rows exist in tenants / branches / user_tenants.
 *   5. RLS: the new user can SELECT their tenant via the anon JWT-issued session.
 *   6. Calling the RPC a second time fails with errcode 42501 (caller already owns a tenant).
 *   7. Slug auto-suffixing: a second user with the same desired slug gets a "-1" suffix.
 *
 * Cleanup: the two test users are deleted at the end (cascades via FKs).
 */
import { createClient } from "@supabase/supabase-js";

const SB_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SB_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let pass = 0;
let fail = 0;
function ok(label) {
  pass++;
  console.info(`  PASS  ${label}`);
}
function bad(label, why) {
  fail++;
  console.info(`  FAIL  ${label}  -  ${why}`);
}

async function createTestUser(email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Onboarding Test" },
  });
  if (error) throw error;
  return data.user;
}

async function getUserClient(email, password) {
  const c = createClient(SB_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client: c, session: data.session, user: data.user };
}

async function main() {
  const stamp = Date.now();
  const userA = `onboard-a-${stamp}@shopos.test`;
  const userB = `onboard-b-${stamp}@shopos.test`;
  const password = "TestPass123!";
  const desiredSlug = `acme-test-${stamp}`;

  console.info("\n[1] Create two fresh auth users via the admin API");
  const aUser = await createTestUser(userA, password);
  const bUser = await createTestUser(userB, password);
  ok(`created ${userA} (id=${aUser.id.slice(0, 8)})`);
  ok(`created ${userB} (id=${bUser.id.slice(0, 8)})`);

  console.info("\n[2] User A signs in and calls create_tenant_with_owner");
  const a = await getUserClient(userA, password);
  let aTenantId;
  let aBranchId;
  let aSlug;
  {
    const { data, error } = await a.client
      .rpc("create_tenant_with_owner", {
        p_legal_name: "Acme Test Ltd",
        p_display_name: "Acme Test Shop",
        p_slug: desiredSlug,
        p_vat_number: "IE9999999A",
        p_country: "IE",
        p_currency: "EUR",
        p_timezone: "Europe/Dublin",
        p_locale: "en-IE",
        p_branch_code: "MAIN",
        p_branch_name: "Acme Test Shop",
        p_branch_address_line1: "1 Test Street",
        p_branch_city: "Dublin",
        p_branch_county: "Dublin",
        p_branch_eircode: "D07 XY99",
      })
      .single();
    if (error) {
      bad("RPC succeeded for user A", error.message);
    } else if (!data?.tenant_id || !data?.branch_id) {
      bad("RPC returned tenant + branch ids", JSON.stringify(data));
    } else {
      aTenantId = data.tenant_id;
      aBranchId = data.branch_id;
      aSlug = data.slug;
      ok(`RPC returned tenant_id=${aTenantId.slice(0, 8)} branch_id=${aBranchId.slice(0, 8)} slug=${aSlug}`);
      if (aSlug !== desiredSlug) bad("slug matches what we asked for", `got ${aSlug}`);
      else ok("slug matches what we asked for");
    }
  }

  console.info("\n[3] Rows exist in tenants / branches / user_tenants (admin view)");
  if (aTenantId) {
    const { data: t } = await admin
      .from("tenants")
      .select("id, slug, display_name, status, country")
      .eq("id", aTenantId)
      .single();
    if (t && t.slug === aSlug && t.status === "trial" && t.country === "IE") {
      ok(`tenants row OK (slug=${t.slug} status=${t.status} country=${t.country})`);
    } else {
      bad("tenants row OK", JSON.stringify(t));
    }

    const { data: b } = await admin
      .from("branches")
      .select("id, code, name, tenant_id, eircode")
      .eq("id", aBranchId)
      .single();
    if (b && b.tenant_id === aTenantId && b.code === "MAIN" && b.eircode === "D07 XY99") {
      ok(`branches row OK (code=${b.code} eircode=${b.eircode})`);
    } else {
      bad("branches row OK", JSON.stringify(b));
    }

    const { data: ut } = await admin
      .from("user_tenants")
      .select("user_id, tenant_id, role, is_active")
      .eq("user_id", aUser.id)
      .eq("tenant_id", aTenantId)
      .single();
    if (ut && ut.role === "owner" && ut.is_active === true) {
      ok(`user_tenants row OK (role=${ut.role})`);
    } else {
      bad("user_tenants row OK", JSON.stringify(ut));
    }
  }

  console.info("\n[4] User A can read their own tenant under RLS");
  if (aTenantId) {
    const { data, error } = await a.client
      .from("tenants")
      .select("id, display_name")
      .eq("id", aTenantId)
      .single();
    if (error) bad("RLS lets owner read own tenant", error.message);
    else if (data?.id !== aTenantId) bad("RLS lets owner read own tenant", "wrong row");
    else ok(`RLS lets owner read own tenant (${data.display_name})`);
  }

  console.info("\n[5] Calling RPC a second time fails with 42501");
  if (aTenantId) {
    const { error } = await a.client
      .rpc("create_tenant_with_owner", {
        p_legal_name: "Acme 2",
        p_display_name: "Acme 2",
        p_slug: `${desiredSlug}-second`,
      })
      .single();
    if (!error) bad("second RPC call rejected", "no error returned");
    else if (error.code !== "42501")
      bad("second RPC call rejected with 42501", `got code=${error.code} message=${error.message}`);
    else ok(`second RPC call rejected with 42501 (${error.message})`);
  }

  console.info("\n[6] User B uses the same desired slug -> server auto-suffixes");
  const b = await getUserClient(userB, password);
  let bSlug;
  let bTenantId;
  {
    const { data, error } = await b.client
      .rpc("create_tenant_with_owner", {
        p_legal_name: "Acme Test Ltd Two",
        p_display_name: "Acme Test Shop Two",
        p_slug: desiredSlug,
      })
      .single();
    if (error) bad("user B RPC succeeded", error.message);
    else if (data?.slug === desiredSlug) bad("server auto-suffixed slug", `got ${data.slug}, expected suffix`);
    else if (!data?.slug?.startsWith(desiredSlug + "-"))
      bad("server auto-suffixed slug", `got ${data?.slug}`);
    else {
      bSlug = data.slug;
      bTenantId = data.tenant_id;
      ok(`server auto-suffixed slug -> ${bSlug}`);
    }
  }

  console.info("\n[7] Cleanup");
  if (aTenantId) await admin.from("tenants").delete().eq("id", aTenantId);
  if (bTenantId) await admin.from("tenants").delete().eq("id", bTenantId);
  await admin.auth.admin.deleteUser(aUser.id);
  await admin.auth.admin.deleteUser(bUser.id);
  ok("removed tenants + auth users");

  console.info("\n----");
  console.info(`PASS: ${pass}    FAIL: ${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("[test-onboarding-flow] crashed:", e);
  process.exit(1);
});
