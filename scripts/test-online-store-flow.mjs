#!/usr/bin/env node
/**
 * End-to-end test: online storefront RPC + stock sync with POS pool.
 *
 * Prerequisites: local Supabase + needscarlow seed (or any tenant with slug + stock).
 */
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const NEEDSCARLOW_TENANT = "00000000-0000-0000-0000-000000000002";
const NEEDSCARLOW_BRANCH = "00000000-0000-0000-0000-000000000011";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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

async function main() {
  console.info("\n=== Online store flow test ===\n");

  // 1. Storefront settings
  const { data: sf, error: sfErr } = await admin
    .from("tenant_storefronts")
    .select("enabled, branch_id, low_stock_threshold")
    .eq("tenant_id", NEEDSCARLOW_TENANT)
    .maybeSingle();

  if (sfErr) bad("tenant_storefronts row", sfErr.message);
  else if (!sf?.enabled) bad("storefront enabled", "disabled");
  else ok(`storefront enabled (branch=${sf.branch_id?.slice(0, 8)}…)`);

  const { data: tenant } = await admin
    .from("tenants")
    .select("slug, display_name")
    .eq("id", NEEDSCARLOW_TENANT)
    .single();

  if (!tenant?.slug) {
    bad("needscarlow tenant", "missing");
    process.exit(1);
  }
  ok(`tenant slug=${tenant.slug}`);

  // 2. Pick product with stock >= 2
  const { data: balances } = await admin
    .from("stock_balances")
    .select("product_id, quantity")
    .eq("tenant_id", NEEDSCARLOW_TENANT)
    .eq("branch_id", NEEDSCARLOW_BRANCH)
    .eq("state", "available")
    .gte("quantity", 2)
    .order("quantity", { ascending: false })
    .limit(1);

  const productId = balances?.[0]?.product_id;
  const stockBefore = Number(balances?.[0]?.quantity ?? 0);

  if (!productId) {
    bad("product with stock", "none found — run db:seed:needscarlow");
    process.exit(1);
  }

  const { data: product } = await admin
    .from("products")
    .select("name, selling_price, is_active")
    .eq("id", productId)
    .single();

  ok(`product "${product?.name}" stock=${stockBefore}`);

  const orderQty = 1;
  const clientUuid = crypto.randomUUID();

  // 3. Place online order
  const { data: orderRes, error: orderErr } = await admin.rpc("commit_online_order", {
    p_tenant_slug: tenant.slug,
    p_items: [{ product_id: productId, qty: orderQty }],
    p_customer: {
      name: "Test Shopper",
      phone: "+353871234567",
      email: "test@example.com",
      address: "1 Test St, Carlow",
      notes: "Automated test order",
    },
    p_client_uuid: clientUuid,
  });

  if (orderErr) {
    bad("commit_online_order", orderErr.message);
  } else {
    const row = orderRes?.[0];
    if (!row?.online_order_id || !row?.order_number) {
      bad("commit_online_order response", JSON.stringify(orderRes));
    } else {
      ok(
        `order ${row.order_number} total=${row.total} delivery=${row.delivery_fee ?? 0} sale=${row.sale_id?.slice(0, 8)}…`,
      );
      if (Number(row.delivery_fee) >= 0) ok("delivery_fee in RPC response");

      const { data: sale } = await admin
        .from("sales")
        .select("channel, total")
        .eq("id", row.sale_id)
        .single();
      if (sale?.channel === "online") ok("sale channel=online");
      else bad("sale channel", sale?.channel ?? "missing");

      const { data: oo } = await admin
        .from("online_orders")
        .select("status, customer_name")
        .eq("id", row.online_order_id)
        .single();
      if (oo?.status === "pending") ok("online_order status=pending");
      else bad("online_order status", oo?.status ?? "missing");
    }
  }

  // 4. Stock decremented
  const { data: balAfter } = await admin
    .from("stock_balances")
    .select("quantity")
    .eq("tenant_id", NEEDSCARLOW_TENANT)
    .eq("branch_id", NEEDSCARLOW_BRANCH)
    .eq("product_id", productId)
    .eq("state", "available")
    .maybeSingle();

  const stockAfter = Number(balAfter?.quantity ?? 0);
  if (stockAfter === stockBefore - orderQty) {
    ok(`stock ${stockBefore} → ${stockAfter}`);
  } else {
    bad("stock after order", `expected ${stockBefore - orderQty}, got ${stockAfter}`);
  }

  // 5. Idempotency replay
  const { data: replay, error: replayErr } = await admin.rpc("commit_online_order", {
    p_tenant_slug: tenant.slug,
    p_items: [{ product_id: productId, qty: orderQty }],
    p_customer: { name: "Test", phone: "+353871234567" },
    p_client_uuid: clientUuid,
  });
  if (replayErr) bad("idempotent replay", replayErr.message);
  else {
    const { data: bal2 } = await admin
      .from("stock_balances")
      .select("quantity")
      .eq("product_id", productId)
      .eq("branch_id", NEEDSCARLOW_BRANCH)
      .eq("state", "available")
      .maybeSingle();
    if (Number(bal2?.quantity) === stockAfter) ok("idempotent replay did not double-deduct stock");
    else bad("idempotent replay stock", `changed to ${bal2?.quantity}`);
  }

  // 6. Insufficient stock rejected
  const { error: overErr } = await admin.rpc("commit_online_order", {
    p_tenant_slug: tenant.slug,
    p_items: [{ product_id: productId, qty: 99999 }],
    p_customer: {
      name: "Greedy",
      phone: "+353871234567",
      fulfillment: "delivery",
      address: "1 Test St, Carlow",
    },
  });
  if (overErr?.message?.includes("insufficient stock")) ok("rejects over-order");
  else bad("over-order guard", overErr?.message ?? "no error");

  // 7. Takeaway order (no delivery fee)
  const pickup = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const { data: takeawayRes, error: takeawayErr } = await admin.rpc("commit_online_order", {
    p_tenant_slug: tenant.slug,
    p_items: [{ product_id: productId, qty: orderQty }],
    p_customer: {
      name: "Collect Shopper",
      phone: "+353871234568",
      fulfillment: "takeaway",
      payment_method: "cod",
      pickup_at: pickup,
    },
  });
  if (takeawayErr) bad("takeaway order", takeawayErr.message);
  else {
    const trow = takeawayRes?.[0];
    if (Number(trow?.delivery_fee) === 0) ok("takeaway order has no delivery fee");
    else bad("takeaway delivery_fee", String(trow?.delivery_fee));
  }

  // 8. Public shop page (Next.js — content is streamed; check title/meta, not full RSC HTML)
  try {
    const res = await fetch(`${APP_URL}/shop/${tenant.slug}`, { redirect: "follow" });
    const html = await res.text();
    if (res.status !== 200) bad("shop page", `status=${res.status}`);
    else if (html.includes("Needscarlow") || html.includes("needscarlow"))
      ok(`GET /shop/${tenant.slug} (${res.status}, shop in document)`);
    else bad("shop page", "expected shop name in HTML shell");
  } catch (e) {
    bad("shop page fetch", e instanceof Error ? e.message : String(e));
  }

  console.info(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
