#!/usr/bin/env node
/**
 * Point cloud Auth emails at the live ShopOS URL (not localhost).
 *
 * Requires SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)
 * and optional SUPABASE_PROJECT_REF (defaults to the live project).
 *
 *   npx --env-file=.env.cloud.local node scripts/set-cloud-auth-urls.mjs
 */
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF?.trim() || "emcegqocydcdztwiwivi";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const LIVE = "https://shopos-red.vercel.app";

if (!TOKEN) {
  console.error("Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens");
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;

const recoveryHtml = `<h2>Reset your ShopOS password</h2>
<p>Use the newest email. This link opens the live shop, not localhost.</p>
<p><a href="${LIVE}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Set a new password</a></p>`;

const confirmHtml = `<h2>Confirm your ShopOS email</h2>
<p>This link opens the live shop, not localhost.</p>
<p><a href="${LIVE}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/dashboard">Confirm email</a></p>`;

const magicHtml = `<h2>Sign in to ShopOS</h2>
<p><a href="${LIVE}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/dashboard">Sign in</a></p>`;

const allow = [
  LIVE,
  `${LIVE}/**`,
  `${LIVE}/auth/callback`,
  `${LIVE}/auth/callback/**`,
  "http://localhost:3000",
  "http://localhost:3000/**",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3000/**",
  "https://*.vercel.app",
  "https://*.vercel.app/**",
].join(",");

const beforeRes = await fetch(API, {
  headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
});
if (!beforeRes.ok) {
  console.error("STATUS get_failed", beforeRes.status, await beforeRes.text());
  process.exit(1);
}
const before = await beforeRes.json();
console.info("BEFORE site_url", before.site_url);
console.info("BEFORE uri_allow_list", before.uri_allow_list);

const patchRes = await fetch(API, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    site_url: LIVE,
    uri_allow_list: allow,
    mailer_templates_recovery_content: recoveryHtml,
    mailer_templates_confirmation_content: confirmHtml,
    mailer_templates_magic_link_content: magicHtml,
  }),
});
if (!patchRes.ok) {
  console.error("STATUS patch_failed", patchRes.status, await patchRes.text());
  process.exit(1);
}
const after = await patchRes.json();
console.info("AFTER site_url", after.site_url);
console.info("AFTER uri_allow_list", after.uri_allow_list);
console.info("STATUS auth_urls_live");
