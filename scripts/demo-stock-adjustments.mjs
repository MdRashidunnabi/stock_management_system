#!/usr/bin/env node
/**
 * Demo: adjust stock on a few Needscarlow products and print before/after.
 * Run: node --env-file=.env.local scripts/demo-stock-adjustments.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRANCH_ID = "00000000-0000-0000-0000-000000000011";
const EMAIL = "owner@needscarlow.shopos.local";
const PASS = "DemoPass123!";

const TARGETS = [
  { sku: "NC-FOOD-0001", newQty: 42 },
  { sku: "NC-FOOD-0002", newQty: 88 },
  { sku: "NC-FOOD-0003", newQty: 15 },
];

if (!url || !anon || !service) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, or SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

async function stockForProduct(productId) {
  const { data } = await admin
    .from("stock_balances")
    .select("quantity")
    .eq("branch_id", BRANCH_ID)
    .eq("product_id", productId)
    .eq("state", "available")
    .is("variant_id", null)
    .maybeSingle();
  return Number(data?.quantity ?? 0);
}

async function main() {
  const userClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signErr } = await userClient.auth.signInWithPassword({
    email: EMAIL,
    password: PASS,
  });
  if (signErr) {
    console.error("Sign-in failed:", signErr.message);
    process.exit(1);
  }

  console.info("\n=== Stock adjustment demo (Needscarlow / NCAR) ===\n");

  for (const t of TARGETS) {
    const { data: prod, error: pErr } = await admin
      .from("products")
      .select("id, name, sku")
      .eq("sku", t.sku)
      .maybeSingle();
    if (pErr || !prod) {
      console.error(`Product ${t.sku} not found`);
      continue;
    }

    const before = await stockForProduct(prod.id);
    const { data, error } = await userClient.rpc("apply_stock_adjustment", {
      p_branch_id: BRANCH_ID,
      p_product_id: prod.id,
      p_reason: "Demo stock count — owner manual update",
      p_delta: null,
      p_new_quantity: t.newQty,
    }).single();

    if (error) {
      console.error(`FAIL ${t.sku}:`, error.message);
      continue;
    }

    const after = await stockForProduct(prod.id);
    console.info(`${prod.sku} · ${prod.name}`);
    console.info(`  Before: ${fmt(before)} un`);
    console.info(`  Set to: ${fmt(t.newQty)} un`);
    console.info(`  RPC:    ${fmt(Number(data.previous_qty))} → ${fmt(Number(data.new_qty))}`);
    console.info(`  DB now: ${fmt(after)} un ${after === t.newQty ? "✓" : "✗ MISMATCH"}\n`);
  }

  console.info("Open Products in the app, branch NCAR — Available column should match.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
