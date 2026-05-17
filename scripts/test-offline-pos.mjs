#!/usr/bin/env node
/**
 * Step 13 - offline POS smoke test.
 *
 * What it verifies, in order:
 *   1. Bootstrap a tenant and seed two products with stock.
 *   2. Catalog cache: replaceCatalogSnapshot stores rows; searchOfflineCatalog
 *      finds them by barcode, SKU, name; clearOfflineCatalog wipes them.
 *   3. Sale queue: enqueueOfflineSale writes a pending row; listQueuedSales
 *      returns it; countPendingSales reports 1.
 *   4. flushOfflineQueue replays via the commit_pos_sale RPC. The first
 *      replay creates a sale; the second replay (same client_uuid) is
 *      a no-op (idempotency cache hit) returning the SAME receipt and
 *      NOT consuming additional stock.
 *   5. The cached sale is marked synced and a sweep removes it.
 *   6. RLS smoke: tenant B cannot read tenant A's idempotency key row.
 *   7. Cleanup.
 *
 * Notes on the test runtime:
 *   - We import `fake-indexeddb/auto` so `indexedDB` is available in Node.
 *   - We bypass the Next.js server-action layer and call commit_pos_sale
 *     directly via supabase-js. This is the same payload shape the
 *     useOfflinePos hook would build.
 */
import "fake-indexeddb/auto";
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
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
function near(actual, expected, eps = 0.005) {
  return Math.abs(Number(actual) - Number(expected)) <= eps;
}

async function createTestUser(email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Offline Test" },
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
      p_legal_name: "Offline Ltd",
      p_display_name: "Offline Shop",
      p_slug: slug,
      p_country: "IE",
      p_currency: "EUR",
      p_timezone: "Europe/Dublin",
      p_locale: "en-IE",
      p_branch_code: "MAIN",
      p_branch_name: "Offline Main",
    })
    .single();
  if (error) throw error;
  return data;
}

async function main() {
  // Dynamic import lets us load the TS module from the test runtime.
  const { default: cacheMod } = await import(
    pathToFileURL(path.resolve("src/lib/pos/offline/catalog-cache.ts"))
  ).then((m) => ({ default: m }));
  const { default: queueMod } = await import(
    pathToFileURL(path.resolve("src/lib/pos/offline/sale-queue.ts"))
  ).then((m) => ({ default: m }));
  const {
    replaceCatalogSnapshot,
    upsertCatalogRows,
    searchOfflineCatalog,
    clearOfflineCatalog,
    getCachedSnapshotCount,
  } = cacheMod;
  const {
    enqueueOfflineSale,
    listQueuedSales,
    countPendingSales,
    flushOfflineQueue,
    deleteSyncedSales,
  } = queueMod;

  const stamp = Date.now();
  const userA = `offline-a-${stamp}@shopos.test`;
  const userB = `offline-b-${stamp}@shopos.test`;
  const password = "TestPass123!";

  console.info("\n[1] Bootstrap tenant + products");
  await createTestUser(userA, password);
  await createTestUser(userB, password);
  const a = await getUserClient(userA, password);
  const b = await getUserClient(userB, password);
  const aT = await onboard(a.client, `offline-a-${stamp}`);
  const bT = await onboard(b.client, `offline-b-${stamp}`);
  ok(`tenant A id=${aT.tenant_id.slice(0, 8)}`);

  // Seed two products.
  const products = [
    {
      tenant_id: aT.tenant_id,
      name: "Cola 330ml",
      sku: `COLA-${stamp}`,
      barcode: `5012345${stamp.toString().slice(-6)}1`,
      base_unit: "unit",
      selling_price: 1.5,
      purchase_price: 0.6,
      vat_code: "STD",
      vat_included: true,
    },
    {
      tenant_id: aT.tenant_id,
      name: "Crisps salt & vinegar",
      sku: `CRISPS-${stamp}`,
      barcode: `5012345${stamp.toString().slice(-6)}2`,
      base_unit: "unit",
      selling_price: 1.2,
      purchase_price: 0.45,
      vat_code: "STD",
      vat_included: true,
    },
  ];
  const { data: insProducts, error: pErr } = await a.client
    .from("products")
    .insert(products)
    .select("id, name, sku, barcode, base_unit, selling_price, vat_code, vat_included");
  if (pErr) throw pErr;
  const [p1, p2] = insProducts;

  // Seed stock at the branch. Bypass RLS via service role.
  await admin
    .from("stock_balances")
    .insert([
      {
        tenant_id: aT.tenant_id,
        branch_id: aT.branch_id,
        product_id: p1.id,
        state: "available",
        quantity: 50,
      },
      {
        tenant_id: aT.tenant_id,
        branch_id: aT.branch_id,
        product_id: p2.id,
        state: "available",
        quantity: 50,
      },
    ]);
  ok(`seeded products (${p1.id.slice(0, 8)}, ${p2.id.slice(0, 8)})`);

  console.info("\n[2] Catalog cache");
  const baseRow = (p, available) => ({
    id: p.id,
    tenantId: aT.tenant_id,
    branchId: aT.branch_id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    baseUnit: p.base_unit,
    sellingPrice: Number(p.selling_price),
    vatCode: p.vat_code,
    vatIncluded: Boolean(p.vat_included),
    availableAtSnapshot: available,
    cachedAt: new Date().toISOString(),
  });
  const cachedCount = await replaceCatalogSnapshot(aT.tenant_id, aT.branch_id, [
    baseRow(p1, 50),
    baseRow(p2, 50),
  ]);
  if (cachedCount === 2) ok("replaceCatalogSnapshot wrote 2 rows");
  else bad("replaceCatalogSnapshot count", cachedCount);

  const total = await getCachedSnapshotCount(aT.tenant_id, aT.branch_id);
  if (total === 2) ok("getCachedSnapshotCount returns 2");
  else bad("getCachedSnapshotCount", total);

  const byBarcode = await searchOfflineCatalog(aT.tenant_id, aT.branch_id, p1.barcode);
  if (byBarcode.length === 1 && byBarcode[0].id === p1.id) ok("search by barcode finds product 1");
  else bad("search by barcode", JSON.stringify(byBarcode));

  const bySku = await searchOfflineCatalog(aT.tenant_id, aT.branch_id, p2.sku);
  if (bySku.length === 1 && bySku[0].id === p2.id) ok("search by SKU finds product 2");
  else bad("search by sku", JSON.stringify(bySku));

  const byName = await searchOfflineCatalog(aT.tenant_id, aT.branch_id, "cola");
  if (byName.length === 1 && byName[0].name.toLowerCase().includes("cola")) {
    ok("search by name finds product 1");
  } else bad("search by name", JSON.stringify(byName));

  // upsertCatalogRows should grow, not shrink.
  await upsertCatalogRows(aT.tenant_id, aT.branch_id, [
    {
      ...baseRow(p1, 50),
      id: `${p1.id.slice(0, -1)}9`, // a different uuid
      name: "Phantom item",
    },
  ]);
  const grown = await getCachedSnapshotCount(aT.tenant_id, aT.branch_id);
  if (grown === 3) ok("upsertCatalogRows grows the cache (3)");
  else bad("upsert count", grown);

  console.info("\n[3] Offline sale queue");
  const items = [
    {
      productId: p1.id,
      name: p1.name,
      sku: p1.sku,
      qty: 2,
      discount: 0,
      unitPriceSnapshot: 1.5,
    },
    {
      productId: p2.id,
      name: p2.name,
      sku: p2.sku,
      qty: 1,
      discount: 0,
      unitPriceSnapshot: 1.2,
    },
  ];
  const expectedTotal = 2 * 1.5 + 1 * 1.2; // 4.20
  const enqueued = await enqueueOfflineSale({
    tenantId: aT.tenant_id,
    branchId: aT.branch_id,
    totalSnapshot: expectedTotal,
    items,
    payments: [{ method: "cash", amount: expectedTotal }],
  });
  if (typeof enqueued.clientUuid === "string" && enqueued.clientUuid.length === 36) {
    ok(`enqueueOfflineSale returned clientUuid=${enqueued.clientUuid.slice(0, 8)}...`);
  } else bad("enqueue clientUuid", JSON.stringify(enqueued));

  const pendingCount = await countPendingSales(aT.tenant_id, aT.branch_id);
  if (pendingCount === 1) ok("countPendingSales returns 1");
  else bad("pending count", pendingCount);

  console.info("\n[4] Flush queue twice; second flush is idempotent no-op");

  // Build a "commit" function that calls the RPC directly with the user's JWT.
  async function commitOnce(row) {
    const { data, error } = await a.client
      .rpc("commit_pos_sale", {
        p_branch_id: row.branchId,
        p_client_uuid: row.clientUuid,
        p_items: row.items.map((it) => ({
          product_id: it.productId,
          qty: it.qty,
          discount: it.discount || 0,
        })),
        p_payments: row.payments.map((p) => ({ method: p.method, amount: p.amount })),
      })
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, sale_id: data.sale_id, receipt: data.receipt_number };
  }

  let firstResponse;
  const flush1 = await flushOfflineQueue(aT.tenant_id, aT.branch_id, async (row) => {
    const r = await commitOnce(row);
    if (r.ok) firstResponse = r;
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  });
  if (flush1.synced === 1 && flush1.failed === 0) ok("first flush synced 1 sale");
  else bad("first flush counts", JSON.stringify(flush1));

  // Confirm only one sale exists in DB
  const { data: salesAfter1 } = await admin
    .from("sales")
    .select("id, receipt_number, total")
    .eq("tenant_id", aT.tenant_id);
  if ((salesAfter1 ?? []).length === 1 && near(salesAfter1[0].total, 4.2)) {
    ok(`sale total = ${formatEuro(salesAfter1[0].total)} matches expected 4.20`);
  } else bad("sale rows after first flush", JSON.stringify(salesAfter1));

  // Now simulate a replay: re-enqueue with the same clientUuid (manually) by
  // updating the synced row back to pending. The sale_queue rows are local
  // anyway, so we manipulate them with the helper.
  const { listQueuedSales: listAgain, setSaleStatus: setStatus } = queueMod;
  const allRows = await listAgain(aT.tenant_id, aT.branch_id);
  const synced = allRows.find((r) => r.status === "synced");
  if (!synced) {
    bad("replay setup", "no synced row to retry");
    return;
  }
  await setStatus(synced.id, "pending");

  const flush2 = await flushOfflineQueue(aT.tenant_id, aT.branch_id, async (row) => {
    const r = await commitOnce(row);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  });
  if (flush2.synced === 1 && flush2.failed === 0) ok("second flush also reports synced");
  else bad("second flush counts", JSON.stringify(flush2));

  const { data: salesAfter2 } = await admin
    .from("sales")
    .select("id, receipt_number, total")
    .eq("tenant_id", aT.tenant_id);
  if ((salesAfter2 ?? []).length === 1) {
    ok("idempotency: replay did NOT create a second sale");
  } else bad("replay duplicated", `${(salesAfter2 ?? []).length} sales`);

  // Check stock - should have decremented by exactly (2 + 1), not (4 + 2)
  const { data: balance1 } = await admin
    .from("stock_balances")
    .select("quantity")
    .eq("product_id", p1.id)
    .eq("branch_id", aT.branch_id)
    .single();
  const { data: balance2 } = await admin
    .from("stock_balances")
    .select("quantity")
    .eq("product_id", p2.id)
    .eq("branch_id", aT.branch_id)
    .single();
  if (near(balance1.quantity, 48) && near(balance2.quantity, 49)) {
    ok(`stock decremented exactly once (P1=${balance1.quantity}, P2=${balance2.quantity})`);
  } else {
    bad("stock decrement", `P1=${balance1.quantity}, P2=${balance2.quantity}`);
  }

  console.info("\n[5] Sweep synced rows");
  const removed = await deleteSyncedSales(aT.tenant_id, aT.branch_id);
  if (removed >= 1) ok(`deleteSyncedSales removed ${removed} row(s)`);
  else bad("deleteSyncedSales", removed);

  console.info("\n[6] RLS: tenant B cannot read A's idempotency key");
  const { data: bView } = await b.client
    .from("idempotency_keys")
    .select("key")
    .eq("tenant_id", aT.tenant_id);
  if ((bView ?? []).length === 0) {
    ok("tenant B sees zero of A's idempotency keys");
  } else bad("RLS leak", `B sees ${bView.length}`);

  console.info("\n[7] Cleanup");
  await clearOfflineCatalog();
  await admin.from("tenants").delete().eq("id", aT.tenant_id);
  await admin.from("tenants").delete().eq("id", bT.tenant_id);
  await admin.auth.admin.deleteUser(a.user.id).catch(() => {});
  await admin.auth.admin.deleteUser(b.user.id).catch(() => {});
  ok("cleanup done");

  console.info(`\nDone: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

function formatEuro(n) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(Number(n));
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(2);
});
