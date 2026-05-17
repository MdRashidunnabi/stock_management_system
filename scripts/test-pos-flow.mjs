#!/usr/bin/env node
/**
 * Live end-to-end test of the Step 8 POS sale flow against the local
 * Supabase stack (http://127.0.0.1:54321).
 *
 * What it verifies, in order:
 *   1. Bootstrap two onboarded tenants (A and B).
 *   2. Seed two products in tenant A with starting "available" stock.
 *   3. Cashier A commits a multi-line sale paid by mixed cash + card.
 *   4. The receipt header, items, payments, and cash drawer movement all
 *      land atomically AND match the totals returned by the RPC.
 *   5. The stock_ledger gets an "outbound" row per item AND
 *      stock_balances are correctly decremented for branch A.
 *   6. A second sale uses the same open session (no new session is opened).
 *   7. Receipt numbers are sequential per branch.
 *   8. RLS - cashier B cannot see tenant A's sales / sale_items / payments.
 *   9. RLS - cashier B cannot call commit_pos_sale against A's branch.
 *  10. Validation - calling commit_pos_sale with an empty cart fails cleanly.
 *  11. Cleanup: cascade-delete both tenants + auth users.
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
    user_metadata: { full_name: "POS Test" },
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
      p_legal_name: "POS Test Ltd",
      p_display_name: "POS Test Shop",
      p_slug: slug,
      p_country: "IE",
      p_currency: "EUR",
      p_timezone: "Europe/Dublin",
      p_locale: "en-IE",
      p_branch_code: branchCode,
      p_branch_name: "POS Main",
    })
    .single();
  if (error) throw error;
  return data;
}

async function seedProductsAndStock(c, tenantId, branchId, stamp, userId) {
  // Two products: one VAT-inclusive @ 23%, one zero-rated.
  const rows = [
    {
      tenant_id: tenantId,
      name: "POS Test - Cola 330ml",
      sku: `POSTEST-COLA-${stamp}`,
      barcode: `5000000000${String(stamp).slice(-3)}1`,
      base_unit: "un",
      purchase_price: 0.4,
      selling_price: 1.5,
      vat_code: "STD",
      vat_included: true,
      is_active: true,
    },
    {
      tenant_id: tenantId,
      name: "POS Test - Bread Loaf 800g",
      sku: `POSTEST-BREAD-${stamp}`,
      barcode: `5000000000${String(stamp).slice(-3)}2`,
      base_unit: "un",
      purchase_price: 0.9,
      selling_price: 2.5,
      vat_code: "ZER",
      vat_included: true,
      is_active: true,
    },
  ];
  const { data: prods, error } = await c
    .from("products")
    .insert(rows)
    .select("id, name, sku, selling_price, vat_code, vat_included");
  if (error) throw error;

  // Seed initial "available" stock_balances directly via the service role
  // (bypasses RLS). In production this happens through goods receipts; for
  // this smoke test we just inject the starting count so the sale has stock
  // to consume.
  const balanceRows = prods.map((p) => ({
    tenant_id: tenantId,
    branch_id: branchId,
    product_id: p.id,
    state: "available",
    quantity: 50,
  }));
  const { error: balErr } = await admin
    .from("stock_balances")
    .upsert(balanceRows, { onConflict: "tenant_id,branch_id,product_id,variant_id,state" });
  if (balErr) throw balErr;
  void userId;
  return prods;
}

async function main() {
  const stamp = Date.now();
  const userA = `pos-a-${stamp}@shopos.test`;
  const userB = `pos-b-${stamp}@shopos.test`;
  const password = "TestPass123!";
  const slugA = `pos-a-${stamp}`;
  const slugB = `pos-b-${stamp}`;

  console.info("\n[1] Bootstrap two tenants");
  const aUser = await createTestUser(userA, password);
  const bUser = await createTestUser(userB, password);
  const a = await getUserClient(userA, password);
  const b = await getUserClient(userB, password);
  const aOnboard = await onboardUser(a.client, slugA, "MAIN");
  const bOnboard = await onboardUser(b.client, slugB, "BRX");
  ok(`tenant A id=${aOnboard.tenant_id.slice(0, 8)} branch=${aOnboard.branch_id.slice(0, 8)}`);
  ok(`tenant B id=${bOnboard.tenant_id.slice(0, 8)}`);

  console.info("\n[2] Seed products + stock for tenant A");
  const [cola, bread] = await seedProductsAndStock(
    a.client,
    aOnboard.tenant_id,
    aOnboard.branch_id,
    stamp,
    aUser.id,
  );
  ok(`seeded ${cola.sku} (STD/incl) and ${bread.sku} (ZER) - 50 each in stock`);

  console.info("\n[3] First sale: 2x cola + 3x bread, 5 EUR cash + rest card");
  // Expected:
  //   cola line:   1.5 * 2 = 3.00 gross, vat 23% -> net 2.4390, vat 0.5610
  //   bread line:  2.5 * 3 = 7.50 gross, vat 0   -> net 7.5000, vat 0.0000
  //   total: 10.50 gross, vat 0.56
  let firstSaleId;
  let firstReceipt;
  let firstSession;
  {
    const { data, error } = await a.client
      .rpc("commit_pos_sale", {
        p_branch_id: aOnboard.branch_id,
        p_items: [
          { product_id: cola.id, qty: 2, discount: 0 },
          { product_id: bread.id, qty: 3, discount: 0 },
        ],
        p_payments: [
          { method: "cash", amount: 5 },
          { method: "card", amount: 5.5 },
        ],
      })
      .single();
    if (error) {
      bad("commit_pos_sale", error.message);
      process.exit(1);
    }
    firstSaleId = data.sale_id;
    firstReceipt = data.receipt_number;
    firstSession = data.pos_session_id;
    ok(`commit_pos_sale -> ${firstReceipt}, total=${data.total}, vat=${data.vat_total}`);

    if (Math.abs(Number(data.total) - 10.5) > 0.01) {
      bad("total", `expected 10.50, got ${data.total}`);
    } else {
      ok("total = 10.50");
    }
    if (Math.abs(Number(data.vat_total) - 0.56) > 0.01) {
      bad("vat_total", `expected 0.56, got ${data.vat_total}`);
    } else {
      ok("vat_total = 0.56 (only the cola line carries VAT)");
    }
  }

  console.info("\n[4] Verify rows: sale + items + payments + cash drawer");
  {
    const { data: sale } = await a.client
      .from("sales")
      .select("receipt_number, total, vat_total, subtotal, status, vat_breakdown")
      .eq("id", firstSaleId)
      .single();
    if (!sale || sale.status !== "completed") bad("sale row", "not found / wrong status");
    else ok(`sale row status=${sale.status} subtotal=${sale.subtotal}`);
    if (sale && sale.vat_breakdown && sale.vat_breakdown.STD && sale.vat_breakdown.ZER) {
      ok(`vat_breakdown has STD + ZER buckets`);
    } else {
      bad("vat_breakdown shape", JSON.stringify(sale?.vat_breakdown ?? {}));
    }

    const { data: items } = await a.client
      .from("sale_items")
      .select("name_snapshot, quantity, line_total_gross")
      .eq("sale_id", firstSaleId)
      .order("position", { ascending: true });
    if (!items || items.length !== 2) bad("sale_items", `expected 2 rows, got ${items?.length ?? 0}`);
    else ok(`sale_items rows = 2`);

    const { data: payments } = await a.client
      .from("payments")
      .select("method, amount, status")
      .eq("sale_id", firstSaleId)
      .order("created_at", { ascending: true });
    if (!payments || payments.length !== 2) bad("payments", `expected 2 rows, got ${payments?.length ?? 0}`);
    else if (payments.some((p) => p.status !== "captured")) bad("payments captured", "not all captured");
    else ok(`payments rows = 2 (cash + card, both captured)`);

    const { data: cdm } = await a.client
      .from("cash_drawer_movements")
      .select("type, amount")
      .eq("pos_session_id", firstSession)
      .eq("reference_id", firstSaleId);
    if (!cdm || cdm.length !== 1) bad("cash_drawer_movements", `expected 1, got ${cdm?.length ?? 0}`);
    else if (Number(cdm[0].amount) !== 5) bad("cash drawer amount", `expected 5, got ${cdm[0].amount}`);
    else ok(`cash drawer movement recorded (5 EUR cash for sale)`);
  }

  console.info("\n[5] Stock ledger + balances after sale 1");
  {
    const { data: ledger } = await a.client
      .from("stock_ledger")
      .select("product_id, movement_type, quantity, from_state, to_state, reference_type, reference_id")
      .eq("reference_type", "sale")
      .eq("reference_id", firstSaleId);
    if (!ledger || ledger.length !== 2) bad("ledger writes", `expected 2 outbound rows, got ${ledger?.length ?? 0}`);
    else if (ledger.some((l) => l.movement_type !== "pos_sale" || l.from_state !== "available" || l.to_state !== null)) {
      bad("ledger row shape", JSON.stringify(ledger));
    } else {
      ok(`stock_ledger has 2 rows (movement_type=pos_sale, available -> NULL)`);
    }

    const { data: balances } = await a.client
      .from("stock_balances")
      .select("product_id, quantity")
      .eq("branch_id", aOnboard.branch_id)
      .eq("state", "available")
      .in("product_id", [cola.id, bread.id]);
    const map = Object.fromEntries((balances ?? []).map((b) => [b.product_id, Number(b.quantity)]));
    if (map[cola.id] !== 48) bad("cola balance", `expected 48, got ${map[cola.id]}`);
    else ok(`cola available = 48 (50 - 2)`);
    if (map[bread.id] !== 47) bad("bread balance", `expected 47, got ${map[bread.id]}`);
    else ok(`bread available = 47 (50 - 3)`);
  }

  console.info("\n[6] Second sale should reuse the same open session");
  let secondReceipt;
  {
    const { data, error } = await a.client
      .rpc("commit_pos_sale", {
        p_branch_id: aOnboard.branch_id,
        p_items: [{ product_id: bread.id, qty: 1, discount: 0 }],
        p_payments: [{ method: "card", amount: 2.5 }],
      })
      .single();
    if (error) bad("second commit", error.message);
    else {
      secondReceipt = data.receipt_number;
      if (data.pos_session_id !== firstSession) {
        bad("session reuse", `new session ${data.pos_session_id} created`);
      } else {
        ok(`session ${firstSession.slice(0, 8)} reused`);
      }
    }
  }

  console.info("\n[7] Receipt numbers are sequential per branch");
  {
    if (!firstReceipt || !secondReceipt) {
      bad("receipt numbers", "missing");
    } else {
      const [, n1] = firstReceipt.split("-");
      const [, n2] = secondReceipt.split("-");
      if (firstReceipt.startsWith("MAIN-") && n2 && parseInt(n2, 10) === parseInt(n1, 10) + 1) {
        ok(`receipt sequence ${firstReceipt} -> ${secondReceipt}`);
      } else {
        bad("receipt sequence", `${firstReceipt} -> ${secondReceipt}`);
      }
    }
  }

  console.info("\n[8] RLS: tenant B cannot see tenant A's sale / items / payments");
  {
    const { data: s } = await b.client.from("sales").select("id").eq("id", firstSaleId);
    if (s?.length) bad("sales hidden from B", `leaked ${s.length}`);
    else ok("sales hidden from tenant B");
    const { data: si } = await b.client.from("sale_items").select("id").eq("sale_id", firstSaleId);
    if (si?.length) bad("sale_items hidden from B", `leaked ${si.length}`);
    else ok("sale_items hidden from tenant B");
    const { data: pm } = await b.client.from("payments").select("id").eq("sale_id", firstSaleId);
    if (pm?.length) bad("payments hidden from B", `leaked ${pm.length}`);
    else ok("payments hidden from tenant B");
  }

  console.info("\n[9] RLS: tenant B cannot commit a sale on tenant A's branch");
  {
    const { error } = await b.client.rpc("commit_pos_sale", {
      p_branch_id: aOnboard.branch_id,
      p_items: [{ product_id: cola.id, qty: 1 }],
      p_payments: [{ method: "cash", amount: 1.5 }],
    });
    if (!error) bad("cross-tenant commit blocked", "no error - data was written!");
    else if (
      error.code === "42501" ||
      /not a staff member/i.test(error.message) ||
      /branch not found/i.test(error.message)
    ) {
      ok(`cross-tenant commit blocked (${error.code ?? error.message})`);
    } else {
      bad("cross-tenant commit blocked", `unexpected error: ${error.code} ${error.message}`);
    }
  }

  console.info("\n[10] Validation: empty cart is rejected");
  {
    const { error } = await a.client.rpc("commit_pos_sale", {
      p_branch_id: aOnboard.branch_id,
      p_items: [],
      p_payments: [{ method: "cash", amount: 1 }],
    });
    if (!error) bad("empty cart rejected", "no error");
    else if (/non-empty/i.test(error.message)) ok("empty cart rejected with clear message");
    else bad("empty cart error message", error.message);
  }

  console.info("\n[11] Validation: under-payment is rejected");
  {
    const { error } = await a.client.rpc("commit_pos_sale", {
      p_branch_id: aOnboard.branch_id,
      p_items: [{ product_id: cola.id, qty: 1 }],
      p_payments: [{ method: "cash", amount: 0.5 }],
    });
    if (!error) bad("under-payment rejected", "no error");
    else if (/less than total/i.test(error.message)) ok("under-payment rejected");
    else bad("under-payment error message", error.message);
  }

  console.info("\n[12] Cleanup");
  await admin.from("tenants").delete().eq("id", aOnboard.tenant_id);
  await admin.from("tenants").delete().eq("id", bOnboard.tenant_id);
  await admin.auth.admin.deleteUser(aUser.id);
  await admin.auth.admin.deleteUser(bUser.id);
  ok("removed tenants + auth users");

  console.info("\n----");
  console.info(`PASS: ${pass}    FAIL: ${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("[test-pos-flow] crashed:", e);
  process.exit(1);
});
