#!/usr/bin/env node
/**
 * Live end-to-end test of the Step 11 owner-dashboard report queries.
 *
 * The dashboard page calls a small set of read-only helpers in
 * src/lib/reports/queries.ts. Those helpers run with the user's RLS
 * context. This test seeds a clean tenant, files a couple of sales and
 * a closed shift with variance, then re-implements the same queries
 * here and asserts the numbers line up with what the dashboard will
 * render.
 *
 * Verifies:
 *   1. Bootstrap tenant.
 *   2. Seed 2 products + stock.
 *   3. Set product_branch_settings.min_stock (triggers low-stock).
 *   4. Open a till with a 100 EUR float.
 *   5. Commit two sales (cash + card).
 *   6. Close the till with a 1 EUR shortage.
 *   7. Sales summary numbers (count, gross, net, vat, cost, profit, margin, avg basket).
 *   8. Top products are ordered by revenue, with correct qty/profit/margin.
 *   9. Low stock list contains exactly the seeded under-stocked product.
 *  10. Session variance picks up the -1 EUR shortage.
 *  11. Daily series puts revenue on today's bucket only.
 *  12. RLS: another tenant cannot see this tenant's metrics.
 *  13. Cleanup.
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
function near(actual, expected, eps = 0.02) {
  return Math.abs(Number(actual) - Number(expected)) <= eps;
}

async function createTestUser(email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Reports Test" },
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

async function onboardUser(c, slug, branchCode) {
  const { data, error } = await c
    .rpc("create_tenant_with_owner", {
      p_legal_name: "Reports Ltd",
      p_display_name: "Reports Shop",
      p_slug: slug,
      p_country: "IE",
      p_currency: "EUR",
      p_timezone: "Europe/Dublin",
      p_locale: "en-IE",
      p_branch_code: branchCode,
      p_branch_name: "Reports Main",
    })
    .single();
  if (error) throw error;
  return data;
}

/* ----------- mini reimplementation of the lib helpers ----------- */

function dublinStartOfDay(date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (n) => parts.find((p) => p.type === n)?.value ?? "00";
  const day = `${get("year")}-${get("month")}-${get("day")}`;
  const utcMid = new Date(`${day}T00:00:00Z`);
  const offsetMin = dublinOffsetMinutes(utcMid);
  return new Date(utcMid.getTime() - offsetMin * 60_000);
}

function dublinOffsetMinutes(at) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Dublin",
    timeZoneName: "shortOffset",
  });
  const tzPart = dtf
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  if (!tzPart) return 0;
  const m = tzPart.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const hours = Number(m[1]);
  const minutes = Number(m[2] ?? 0);
  return hours * 60 + (hours < 0 ? -minutes : minutes);
}

function todayPeriod() {
  const now = new Date();
  return {
    fromIso: dublinStartOfDay(now).toISOString(),
    toIso: now.toISOString(),
  };
}

async function fetchSalesSummary(c, period) {
  const { data: sales } = await c
    .from("sales")
    .select("id, total, subtotal, vat_total, discount_total")
    .eq("status", "completed")
    .gte("created_at", period.fromIso)
    .lt("created_at", period.toIso);
  const ids = (sales ?? []).map((s) => s.id);

  let cost = 0;
  let net = 0;
  if (ids.length > 0) {
    const { data: items } = await c
      .from("sale_items")
      .select("quantity, unit_cost, line_total_net")
      .in("sale_id", ids);
    for (const it of items ?? []) {
      cost += Number(it.quantity ?? 0) * Number(it.unit_cost ?? 0);
      net += Number(it.line_total_net ?? 0);
    }
  }

  const gross = (sales ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);
  const profit = net - cost;
  return {
    salesCount: (sales ?? []).length,
    gross: round2(gross),
    net: round2(net),
    cost: round2(cost),
    profit: round2(profit),
    marginPct: net > 0 ? round2((profit / net) * 100) : 0,
    avgBasket: (sales ?? []).length > 0 ? round2(gross / sales.length) : 0,
  };
}

async function fetchTopProducts(c, period, limit = 5) {
  const { data: sales } = await c
    .from("sales")
    .select("id")
    .eq("status", "completed")
    .gte("created_at", period.fromIso)
    .lt("created_at", period.toIso);
  const ids = (sales ?? []).map((s) => s.id);
  if (ids.length === 0) return [];
  const { data } = await c
    .from("sale_items")
    .select(
      "product_id, name_snapshot, sku_snapshot, quantity, unit_cost, line_total_gross",
    )
    .in("sale_id", ids);
  const agg = new Map();
  for (const r of data ?? []) {
    const cur = agg.get(r.product_id) ?? {
      product_id: r.product_id,
      name: r.name_snapshot,
      qty: 0,
      revenue: 0,
      cost: 0,
    };
    const qty = Number(r.quantity ?? 0);
    cur.qty += qty;
    cur.revenue += Number(r.line_total_gross ?? 0);
    cur.cost += qty * Number(r.unit_cost ?? 0);
    agg.set(r.product_id, cur);
  }
  return Array.from(agg.values())
    .map((r) => ({
      ...r,
      qty: round2(r.qty),
      revenue: round2(r.revenue),
      cost: round2(r.cost),
      profit: round2(r.revenue - r.cost),
      margin_pct: r.revenue > 0 ? round2(((r.revenue - r.cost) / r.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

async function fetchLowStock(c) {
  const { data: settings } = await c
    .from("product_branch_settings")
    .select(
      "product_id, branch_id, min_stock, product:products(id, name, is_active), branch:branches!product_branch_settings_branch_id_fkey(id, name, code)",
    )
    .gt("min_stock", 0);
  const list = settings ?? [];
  if (list.length === 0) return [];
  const productIds = Array.from(new Set(list.map((s) => s.product_id)));
  const branchIds = Array.from(new Set(list.map((s) => s.branch_id)));
  const { data: balances } = await c
    .from("stock_balances")
    .select("product_id, branch_id, quantity")
    .in("product_id", productIds)
    .in("branch_id", branchIds)
    .eq("state", "available");
  const onHand = new Map();
  for (const b of balances ?? []) {
    const k = `${b.product_id}|${b.branch_id}`;
    onHand.set(k, (onHand.get(k) ?? 0) + Number(b.quantity ?? 0));
  }
  const out = [];
  for (const s of list) {
    const product = Array.isArray(s.product) ? s.product[0] : s.product;
    const branch = Array.isArray(s.branch) ? s.branch[0] : s.branch;
    if (!product || !branch || !product.is_active) continue;
    const have = onHand.get(`${s.product_id}|${s.branch_id}`) ?? 0;
    if (have <= Number(s.min_stock)) {
      out.push({
        product_id: product.id,
        name: product.name,
        on_hand: round2(have),
        min_stock: round2(Number(s.min_stock)),
        shortfall: round2(Number(s.min_stock) - have),
      });
    }
  }
  return out;
}

async function fetchSessionVariance(c, period) {
  const { data } = await c
    .from("pos_sessions")
    .select("id, expected_cash, counted_cash, cash_difference, closed_at, status")
    .neq("status", "open")
    .gte("closed_at", period.fromIso)
    .lt("closed_at", period.toIso);
  const rows = (data ?? []).filter((r) => r.closed_at);
  return {
    closedSessions: rows.length,
    totalVariance: round2(
      rows.reduce((s, r) => s + Number(r.cash_difference ?? 0), 0),
    ),
  };
}

async function fetchDailySeries(c, days) {
  const now = new Date();
  const startToday = dublinStartOfDay(now);
  const start = new Date(startToday.getTime() - (days - 1) * 86_400_000);
  const end = new Date(startToday.getTime() + 86_400_000);
  const { data } = await c
    .from("sales")
    .select("total, created_at")
    .eq("status", "completed")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  const buckets = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    buckets.set(toDublinDay(d), 0);
  }
  for (const row of data ?? []) {
    const day = toDublinDay(new Date(row.created_at));
    if (buckets.has(day)) buckets.set(day, buckets.get(day) + Number(row.total ?? 0));
  }
  return Array.from(buckets.entries()).map(([day, revenue]) => ({
    day,
    revenue: round2(revenue),
  }));
}

function toDublinDay(d) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const get = (n) => parts.find((p) => p.type === n)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/* --------------------------- main --------------------------- */

async function main() {
  const stamp = Date.now();
  const userA = `rep-a-${stamp}@shopos.test`;
  const userB = `rep-b-${stamp}@shopos.test`;
  const password = "TestPass123!";

  console.info("\n[1] Bootstrap tenants A and B");
  await createTestUser(userA, password);
  await createTestUser(userB, password);
  const a = await getUserClient(userA, password);
  const b = await getUserClient(userB, password);
  const aOnboard = await onboardUser(a.client, `rep-a-${stamp}`, "MAIN");
  const bOnboard = await onboardUser(b.client, `rep-b-${stamp}`, "BRX");
  ok(`tenant A id=${aOnboard.tenant_id.slice(0, 8)}`);

  console.info("\n[2] Seed two products and starting stock");
  const { data: p1, error: p1err } = await a.client
    .from("products")
    .insert({
      tenant_id: aOnboard.tenant_id,
      name: "Reports Coffee",
      sku: `RC-${stamp.toString().slice(-6)}`,
      barcode: `5001${String(stamp).slice(-6)}`,
      base_unit: "un",
      purchase_price: 1.0,
      selling_price: 5.0,
      vat_code: "STD",
      vat_included: true,
      is_active: true,
    })
    .select("id")
    .single();
  if (p1err) throw p1err;
  const { data: p2, error: p2err } = await a.client
    .from("products")
    .insert({
      tenant_id: aOnboard.tenant_id,
      name: "Reports Tea",
      sku: `RT-${stamp.toString().slice(-6)}`,
      barcode: `5002${String(stamp).slice(-6)}`,
      base_unit: "un",
      purchase_price: 0.5,
      selling_price: 2.0,
      vat_code: "STD",
      vat_included: true,
      is_active: true,
    })
    .select("id")
    .single();
  if (p2err) throw p2err;

  await admin.from("stock_balances").upsert(
    [
      {
        tenant_id: aOnboard.tenant_id,
        branch_id: aOnboard.branch_id,
        product_id: p1.id,
        state: "available",
        quantity: 50,
      },
      {
        tenant_id: aOnboard.tenant_id,
        branch_id: aOnboard.branch_id,
        product_id: p2.id,
        state: "available",
        quantity: 30,
      },
    ],
    { onConflict: "tenant_id,branch_id,product_id,variant_id,state" },
  );
  ok("seeded P1=50, P2=30");

  console.info("\n[3] Set min_stock on P1 (low-stock target)");
  {
    const { error } = await a.client.from("product_branch_settings").insert({
      tenant_id: aOnboard.tenant_id,
      product_id: p1.id,
      branch_id: aOnboard.branch_id,
      min_stock: 100,
    });
    if (error) bad("min_stock insert", error.message);
    else ok("P1 min_stock = 100");
  }

  console.info("\n[4] Open a till with EUR 100 float");
  let sessionId;
  {
    const { data, error } = await a.client.rpc("open_pos_session", {
      p_branch_id: aOnboard.branch_id,
      p_opening_cash: 100,
    });
    if (error) {
      bad("open till", error.message);
      process.exit(1);
    }
    sessionId = data;
    ok(`session ${sessionId.slice(0, 8)} opened`);
  }

  console.info("\n[5] Commit two sales");
  // Sale A: 5 x P1 at EUR 5 = EUR 25 gross (cash)
  {
    const { error } = await a.client.rpc("commit_pos_sale", {
      p_branch_id: aOnboard.branch_id,
      p_session_id: sessionId,
      p_items: [{ product_id: p1.id, qty: 5, discount: 0 }],
      p_payments: [{ method: "cash", amount: 25 }],
    });
    if (error) bad("sale A", error.message);
    else ok("sale A: 5 x P1 cash 25.00");
  }
  // Sale B: 3 x P2 at EUR 2 = EUR 6 gross (card)
  {
    const { error } = await a.client.rpc("commit_pos_sale", {
      p_branch_id: aOnboard.branch_id,
      p_session_id: sessionId,
      p_items: [{ product_id: p2.id, qty: 3, discount: 0 }],
      p_payments: [{ method: "card", amount: 6 }],
    });
    if (error) bad("sale B", error.message);
    else ok("sale B: 3 x P2 card 6.00");
  }

  console.info("\n[6] Close till with -1 EUR shortage (counted=124, expected=125)");
  {
    const { error } = await a.client
      .rpc("close_pos_session", {
        p_session_id: sessionId,
        p_counted_cash: 124,
      })
      .single();
    if (error) bad("close till", error.message);
    else ok("till closed with -1 EUR variance");
  }

  console.info("\n[7] Sales summary numbers");
  const period = todayPeriod();
  const summary = await fetchSalesSummary(a.client, period);
  if (summary.salesCount !== 2) bad("salesCount", `expected 2, got ${summary.salesCount}`);
  else ok(`salesCount=${summary.salesCount}`);
  if (!near(summary.gross, 31)) bad("gross", `expected 31.00, got ${summary.gross}`);
  else ok(`gross=${summary.gross} EUR`);
  // Net = 31 / 1.23 = 25.20 (approx, rounding up to 2dp per item)
  if (!near(summary.net, 25.2, 0.05)) bad("net", `expected ~25.20, got ${summary.net}`);
  else ok(`net=${summary.net} EUR (ex VAT)`);
  // cost = 5 * 1.00 + 3 * 0.50 = 6.50
  if (!near(summary.cost, 6.5)) bad("cost", `expected 6.50, got ${summary.cost}`);
  else ok(`cost=${summary.cost} EUR`);
  if (!near(summary.profit, summary.net - summary.cost, 0.02))
    bad("profit", `expected ${summary.net - summary.cost}, got ${summary.profit}`);
  else ok(`profit=${summary.profit} EUR`);
  if (summary.marginPct < 60 || summary.marginPct > 80)
    bad("marginPct sanity", `${summary.marginPct}`);
  else ok(`margin=${summary.marginPct}%`);
  if (!near(summary.avgBasket, 15.5)) bad("avgBasket", `expected 15.50, got ${summary.avgBasket}`);
  else ok(`avg basket=${summary.avgBasket} EUR`);

  console.info("\n[8] Top products ordered correctly");
  const top = await fetchTopProducts(a.client, period, 5);
  if (top.length !== 2) bad("top length", `expected 2, got ${top.length}`);
  else if (top[0].product_id !== p1.id) bad("top order", "expected P1 first");
  else if (!near(top[0].revenue, 25)) bad("P1 revenue", `expected 25, got ${top[0].revenue}`);
  else if (top[1].product_id !== p2.id) bad("top order", "expected P2 second");
  else ok(`top: ${top[0].name} (rev ${top[0].revenue}, profit ${top[0].profit}), ${top[1].name} (rev ${top[1].revenue})`);

  console.info("\n[9] Low stock list contains P1");
  const low = await fetchLowStock(a.client);
  const p1Low = low.find((r) => r.product_id === p1.id);
  if (!p1Low) bad("P1 low-stock", "P1 missing from low-stock list");
  else if (p1Low.on_hand !== 45) bad("P1 on_hand", `expected 45, got ${p1Low.on_hand}`);
  else if (p1Low.min_stock !== 100) bad("P1 min_stock", `expected 100, got ${p1Low.min_stock}`);
  else if (p1Low.shortfall !== 55) bad("P1 shortfall", `expected 55, got ${p1Low.shortfall}`);
  else ok(`P1 low-stock: on_hand=${p1Low.on_hand}, min=${p1Low.min_stock}, short=${p1Low.shortfall}`);
  if (!low.find((r) => r.product_id === p2.id)) ok("P2 not in low-stock (no min_stock set)");
  else bad("P2 unexpected", "P2 should not appear");

  console.info("\n[10] Session variance picks up the shortage");
  const varianceSummary = await fetchSessionVariance(a.client, period);
  if (varianceSummary.closedSessions !== 1) bad("closedSessions", `${varianceSummary.closedSessions}`);
  else ok(`closedSessions=1`);
  if (!near(varianceSummary.totalVariance, -1)) bad("variance", `expected -1.00, got ${varianceSummary.totalVariance}`);
  else ok(`totalVariance=${varianceSummary.totalVariance} EUR`);

  console.info("\n[11] Daily series puts revenue on today's bucket");
  const series = await fetchDailySeries(a.client, 14);
  if (series.length !== 14) bad("series length", `${series.length}`);
  else ok(`series has ${series.length} days`);
  const today = series[series.length - 1];
  if (!near(today.revenue, 31)) bad("today revenue", `expected 31, got ${today.revenue}`);
  else ok(`today (${today.day}) revenue=${today.revenue}`);
  const otherSum = series.slice(0, -1).reduce((s, p) => s + p.revenue, 0);
  if (otherSum !== 0) bad("prior days", `unexpected revenue ${otherSum}`);
  else ok(`prior 13 days have 0 revenue`);

  console.info("\n[12] RLS: tenant B sees nothing of tenant A's data");
  {
    const { data } = await b.client
      .from("sales")
      .select("id")
      .gte("created_at", period.fromIso);
    if ((data ?? []).length === 0) ok("user B sees 0 sales");
    else bad("user B sales", `saw ${data.length} sales`);
  }
  {
    const { data } = await b.client.from("pos_sessions").select("id").eq("id", sessionId);
    if ((data ?? []).length === 0) ok("user B cannot see session");
    else bad("user B session", "leaked a session row");
  }

  console.info("\n[13] Cleanup");
  await admin.from("tenants").delete().eq("id", aOnboard.tenant_id);
  await admin.from("tenants").delete().eq("id", bOnboard.tenant_id);
  ok("cleanup done");

  console.info(`\nDone: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
