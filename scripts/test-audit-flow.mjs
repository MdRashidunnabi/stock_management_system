#!/usr/bin/env node
/**
 * Step 12 - audit log + backup smoke test.
 *
 * What it verifies, in order:
 *   1.  Bootstrap tenants A and B.
 *   2.  Tenant A: insert / update / delete a supplier, a category, and a brand.
 *   3.  For each, exactly one audit row exists with the correct entity_type,
 *       action verb, before/after diff, and tenant_id.
 *   4.  Tenant A: open + close a POS session - audit captures
 *       pos_session.created and pos_session.updated.
 *   5.  RLS: tenant B cannot read tenant A's audit rows via PostgREST.
 *   6.  Backup script: spawn `node scripts/backup-db.mjs --output ...`
 *       against the local Postgres URL, verify that a non-empty dump file
 *       lands on disk and is a valid pg_dump custom-format archive.
 *   7.  Cleanup.
 */
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { mkdtemp, stat, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

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
    user_metadata: { full_name: "Audit Test" },
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
async function onboard(c, slug) {
  const { data, error } = await c
    .rpc("create_tenant_with_owner", {
      p_legal_name: "Audit Ltd",
      p_display_name: "Audit Shop",
      p_slug: slug,
      p_country: "IE",
      p_currency: "EUR",
      p_timezone: "Europe/Dublin",
      p_locale: "en-IE",
      p_branch_code: "MAIN",
      p_branch_name: "Audit Main",
    })
    .single();
  if (error) throw error;
  return data;
}

function spawnPromise(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code, out, err }));
  });
}

async function main() {
  const stamp = Date.now();
  const userA = `audit-a-${stamp}@shopos.test`;
  const userB = `audit-b-${stamp}@shopos.test`;
  const password = "TestPass123!";

  console.info("\n[1] Bootstrap two tenants");
  await createTestUser(userA, password);
  await createTestUser(userB, password);
  const a = await getUserClient(userA, password);
  const b = await getUserClient(userB, password);
  const aT = await onboard(a.client, `audit-a-${stamp}`);
  const bT = await onboard(b.client, `audit-b-${stamp}`);
  ok(`tenant A id=${aT.tenant_id.slice(0, 8)}`);

  // Capture an "audit start time" so we don't pick up rows created by other
  // smoke tests that may be in-flight on the same DB.
  const auditStart = new Date().toISOString();

  console.info("\n[2] Mutate suppliers, categories, brands and verify audit");

  // Insert supplier ---
  const { data: sup, error: e1 } = await a.client
    .from("suppliers")
    .insert({
      tenant_id: aT.tenant_id,
      name: "Audit Supplier",
      code: `AUD-${stamp.toString().slice(-6)}`,
      country: "IE",
    })
    .select("id")
    .single();
  if (e1) throw e1;

  // Update supplier name ---
  const { error: e2 } = await a.client
    .from("suppliers")
    .update({ name: "Audit Supplier (Renamed)" })
    .eq("id", sup.id);
  if (e2) throw e2;

  // Insert category ---
  const { data: cat, error: e3 } = await a.client
    .from("categories")
    .insert({ tenant_id: aT.tenant_id, name: "Audit Cat", slug: `audit-cat-${stamp}` })
    .select("id")
    .single();
  if (e3) throw e3;

  // Insert brand + delete it ---
  const { data: brand, error: e4 } = await a.client
    .from("brands")
    .insert({ tenant_id: aT.tenant_id, name: "Audit Brand", slug: `audit-brand-${stamp}` })
    .select("id")
    .single();
  if (e4) throw e4;
  const { error: e5 } = await a.client.from("brands").delete().eq("id", brand.id);
  if (e5) throw e5;

  // Read back audit rows from tenant A's perspective.
  const { data: auditRows, error: e6 } = await a.client
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, before, after, user_id, tenant_id, created_at")
    .gte("created_at", auditStart)
    .eq("tenant_id", aT.tenant_id)
    .order("created_at", { ascending: true });
  if (e6) throw e6;

  const byAction = (a) => auditRows.filter((r) => r.action === a);
  const supCreated = byAction("supplier.created");
  const supUpdated = byAction("supplier.updated");
  const catCreated = byAction("category.created");
  const brCreated = byAction("brand.created");
  const brDeleted = byAction("brand.deleted");

  if (supCreated.length === 1 && supCreated[0].entity_id === sup.id) {
    ok("supplier.created audit row exists with correct entity_id");
  } else bad("supplier.created", `got ${supCreated.length} rows`);
  if (
    supCreated[0]?.before === null &&
    supCreated[0]?.after?.name === "Audit Supplier"
  ) {
    ok("supplier.created has before=null and after.name");
  } else bad("supplier.created snapshot", JSON.stringify(supCreated[0]));

  if (supUpdated.length === 1) {
    const r = supUpdated[0];
    if (
      r.before?.name === "Audit Supplier" &&
      r.after?.name === "Audit Supplier (Renamed)"
    ) {
      ok("supplier.updated has correct before/after.name diff");
    } else bad("supplier.updated diff", JSON.stringify({ b: r.before?.name, a: r.after?.name }));
  } else bad("supplier.updated", `got ${supUpdated.length} rows`);

  if (catCreated.length === 1 && catCreated[0].entity_id === cat.id) {
    ok("category.created audit row");
  } else bad("category.created", `got ${catCreated.length}`);

  if (brCreated.length === 1 && brDeleted.length === 1) {
    if (brDeleted[0].before?.name === "Audit Brand" && brDeleted[0].after === null) {
      ok("brand.deleted captured before snapshot only");
    } else bad("brand.deleted shape", JSON.stringify(brDeleted[0]));
  } else bad("brand insert+delete pair", `${brCreated.length}+${brDeleted.length}`);

  // Every row should be attributed to the user.
  if (auditRows.every((r) => r.user_id === a.user.id)) {
    ok("every audit row attributed to the acting user");
  } else bad("audit user attribution", "some rows missing user_id");

  console.info("\n[3] Open + close a POS session, verify audit");

  // Open session via RPC (this is SECURITY DEFINER but auth.uid() still works).
  const { data: sessionId, error: oeErr } = await a.client.rpc("open_pos_session", {
    p_branch_id: aT.branch_id,
    p_terminal_id: null,
    p_opening_cash: 100,
    p_note: "audit test",
  });
  if (oeErr) throw oeErr;

  const { error: ceErr } = await a.client.rpc("close_pos_session", {
    p_session_id: sessionId,
    p_counted_cash: 100,
    p_closing_note: "audit close",
  });
  if (ceErr) throw ceErr;

  const { data: sessAudit } = await a.client
    .from("audit_logs")
    .select("action, entity_id, before, after")
    .eq("entity_type", "pos_session")
    .eq("entity_id", sessionId)
    .order("created_at", { ascending: true });
  if (sessAudit.length === 2) {
    const [created, updated] = sessAudit;
    if (
      created.action === "pos_session.created" &&
      updated.action === "pos_session.updated" &&
      created.after?.status === "open" &&
      updated.before?.status === "open" &&
      updated.after?.status === "closed"
    ) {
      ok("pos_session.created + .updated capture the open->closed transition");
    } else bad("pos_session audit", JSON.stringify(sessAudit));
  } else bad("pos_session audit count", `got ${sessAudit.length}`);

  console.info("\n[4] RLS: tenant B cannot see tenant A's audit log");

  const { data: bView } = await b.client
    .from("audit_logs")
    .select("id, tenant_id")
    .eq("tenant_id", aT.tenant_id);
  if ((bView ?? []).length === 0) {
    ok("tenant B sees zero rows of tenant A's audit log");
  } else bad("RLS leak", `B sees ${bView.length} of A's rows`);

  // And tenant B's own log should still have its own rows (from onboarding).
  const { data: bOwn } = await b.client
    .from("audit_logs")
    .select("id")
    .eq("tenant_id", bT.tenant_id);
  if ((bOwn ?? []).length > 0) {
    ok(`tenant B sees its own audit log (${bOwn.length} rows)`);
  } else bad("tenant B own log", "expected at least one row");

  console.info("\n[5] Backup script produces a valid dump");

  const tmp = await mkdtemp(path.join(tmpdir(), "shopos-backup-"));
  const dumpPath = path.join(tmp, "audit-test.dump");
  const { code, out, err } = await spawnPromise("node", [
    "scripts/backup-db.mjs",
    "--output",
    dumpPath,
  ]);

  if (code !== 0) {
    bad("backup-db.mjs exit code", `${code} - stderr: ${err.slice(0, 200)}`);
  } else {
    ok(`backup-db.mjs exited 0 (${out.split("\n").pop()?.trim()})`);
  }

  try {
    const stats = await stat(dumpPath);
    if (stats.size > 1024) {
      ok(`dump is non-empty (${stats.size.toLocaleString()} bytes)`);
    } else {
      bad("dump too small", `${stats.size} bytes`);
    }
    const head = await readFile(dumpPath);
    // pg_dump custom-format archives start with the magic string "PGDMP".
    if (head.slice(0, 5).toString("utf8") === "PGDMP") {
      ok("dump file has the PGDMP custom-format magic header");
    } else {
      bad("dump magic header", head.slice(0, 5).toString("hex"));
    }
  } catch (e) {
    bad("dump file missing", e.message);
  }
  await rm(tmp, { recursive: true, force: true });

  console.info("\n[6] Cleanup");
  await admin.from("tenants").delete().eq("id", aT.tenant_id);
  await admin.from("tenants").delete().eq("id", bT.tenant_id);
  await admin.auth.admin.deleteUser(a.user.id).catch(() => {});
  await admin.auth.admin.deleteUser(b.user.id).catch(() => {});
  ok("cleanup done");

  console.info(`\nDone: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(2);
});
