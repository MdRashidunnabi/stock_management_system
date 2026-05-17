#!/usr/bin/env node
/**
 * Higher-level integration test: drives the full Step-5 + Step-6 path
 * through the running Next.js dev server using real cookies.
 *
 *   1. create a fresh auth user (admin API, email-confirmed)
 *   2. sign in via the SUPABASE auth API to obtain access + refresh tokens
 *   3. install those as the @supabase/ssr cookies the Next app expects
 *   4. GET /onboarding -> 200 (page renders)
 *   5. GET /dashboard  -> 307 -> /onboarding (because no tenant yet)
 *   6. call the create_tenant_with_owner RPC via the same JWT
 *   7. with the same cookies, GET /dashboard -> 200 (tenant resolved)
 *   8. with the same cookies, GET /onboarding -> 307 -> /dashboard
 *      (proves the page redirects users that already have a tenant)
 *   9. cleanup
 */
import { createClient } from "@supabase/supabase-js";

const APP = "http://127.0.0.1:3000";
const SB = "http://127.0.0.1:54321";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SB, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let pass = 0;
let fail = 0;
const ok = (l) => (pass++, console.info(`  PASS  ${l}`));
const bad = (l, why) => (fail++, console.info(`  FAIL  ${l}  -  ${why}`));

/**
 * Build the @supabase/ssr cookie header that Next's server-side Supabase
 * client expects. The format is JSON of [access, refresh, ...] split into
 * "sb-<project>-auth-token.0" / ".1" if the value is too long. For local
 * dev we can just use the un-chunked "sb-<project>-auth-token" cookie.
 *
 * The "project ref" is the host part of the API URL: "127" for 127.0.0.1.
 */
function buildSupabaseCookieHeader(session) {
  const url = new URL(SB);
  const ref = url.hostname.split(".")[0];
  const cookieName = `sb-${ref}-auth-token`;
  // @supabase/ssr expects a base64url-encoded JSON string prefixed with "base64-"
  const payload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: "bearer",
    user: session.user,
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `${cookieName}=base64-${b64}`;
}

async function main() {
  const stamp = Date.now();
  const email = `onboard-app-${stamp}@shopos.test`;
  const password = "TestPass123!";

  console.info("\n[1] create fresh auth user");
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "App Test User" },
  });
  if (cErr) {
    bad("admin createUser", cErr.message);
    process.exit(1);
  }
  ok(`created ${email}`);

  console.info("\n[2] sign in via Supabase auth API");
  const supa = createClient(SB, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: si, error: siErr } = await supa.auth.signInWithPassword({ email, password });
  if (siErr || !si.session) {
    bad("signIn", siErr?.message ?? "no session");
    process.exit(1);
  }
  ok(`signed in (session expires_at=${si.session.expires_at})`);
  const cookieHeader = buildSupabaseCookieHeader(si.session);

  console.info("\n[3] GET /onboarding with the session cookie");
  {
    const r = await fetch(`${APP}/onboarding`, {
      headers: { cookie: cookieHeader },
      redirect: "manual",
    });
    if (r.status === 200) ok("onboarding renders for signed-in tenant-less user");
    else bad("onboarding renders for signed-in tenant-less user", `status=${r.status} loc=${r.headers.get("location")}`);
  }

  console.info("\n[4] GET /dashboard with the session cookie -> redirected to /onboarding");
  {
    const r = await fetch(`${APP}/dashboard`, {
      headers: { cookie: cookieHeader },
      redirect: "manual",
    });
    const loc = r.headers.get("location") ?? "";
    if (r.status === 307 && loc.endsWith("/onboarding"))
      ok("dashboard redirects tenant-less user to /onboarding");
    else
      bad("dashboard redirects tenant-less user to /onboarding", `status=${r.status} loc=${loc}`);
  }

  console.info("\n[5] call create_tenant_with_owner RPC");
  let tenantId;
  {
    const userClient = createClient(SB, ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${si.session.access_token}` } },
    });
    const { data, error } = await userClient
      .rpc("create_tenant_with_owner", {
        p_legal_name: "App Test Co Ltd",
        p_display_name: "App Test Shop",
        p_slug: `app-test-${stamp}`,
        p_branch_code: "MAIN",
        p_branch_name: "App Test Shop - HQ",
      })
      .single();
    if (error || !data?.tenant_id) {
      bad("rpc create_tenant_with_owner", error?.message ?? "no data");
      process.exit(1);
    }
    tenantId = data.tenant_id;
    ok(`rpc returned tenant_id=${tenantId.slice(0, 8)} slug=${data.slug}`);
  }

  console.info("\n[6] GET /dashboard with the same cookies -> 200");
  {
    const r = await fetch(`${APP}/dashboard`, {
      headers: { cookie: cookieHeader },
      redirect: "manual",
    });
    if (r.status === 200) ok("dashboard renders for owner");
    else
      bad("dashboard renders for owner", `status=${r.status} loc=${r.headers.get("location")}`);
  }

  console.info("\n[7] GET /onboarding with the same cookies -> 307 -> /dashboard");
  {
    const r = await fetch(`${APP}/onboarding`, {
      headers: { cookie: cookieHeader },
      redirect: "manual",
    });
    const loc = r.headers.get("location") ?? "";
    if (r.status === 307 && loc.endsWith("/dashboard"))
      ok("onboarding redirects users with a tenant to /dashboard");
    else
      bad("onboarding redirects users with a tenant to /dashboard", `status=${r.status} loc=${loc}`);
  }

  console.info("\n[8] cleanup");
  if (tenantId) await admin.from("tenants").delete().eq("id", tenantId);
  await admin.auth.admin.deleteUser(created.user.id);
  ok("removed tenant + auth user");

  console.info("\n----");
  console.info(`PASS: ${pass}    FAIL: ${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("[test-onboarding-via-app] crashed:", e);
  process.exit(1);
});
