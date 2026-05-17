#!/usr/bin/env node
/**
 * Live end-to-end test of the Step 10 supplier-receiving flow against the
 * local Supabase stack (http://127.0.0.1:54321).
 *
 * What it verifies, in order:
 *   1. Bootstrap two onboarded tenants (A and B).
 *   2. Seed a supplier and two products for tenant A.
 *   3. create_purchase_order with two lines + PO totals are correct.
 *   4. Mark PO as ordered.
 *   5. create_goods_receipt linked to PO (partial: 8 of P1, 5 of P2).
 *   6. Receipt is "draft" - no stock movement, no WAC update yet.
 *   7. finalise_goods_receipt:
 *        - stock_balances at the branch jump to (8, 5).
 *        - stock_ledger has two "goods_receipt" rows.
 *        - product purchase_price is updated to the receipt unit cost
 *          when there was no prior stock.
 *        - PO line qty_received increments correctly.
 *        - PO status rolls to 'partially_received'.
 *   8. A second goods receipt for the remaining 2 of P1 at a higher price
 *      blends the cost with the WAC formula:
 *        new = (balance*old + qty*new_cost) / (balance+qty).
 *   9. After the second receipt is finalised, the PO status is 'received'.
 *  10. Trying to finalise the same GR a second time is rejected.
 *  11. RLS: user B cannot see or modify user A's POs or GRs.
 *  12. Cleanup.
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
function near(actual, expected, eps = 0.005) {
  return Math.abs(Number(actual) - Number(expected)) <= eps;
}

async function createTestUser(email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Purchasing Test" },
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
      p_legal_name: "Purchasing Ltd",
      p_display_name: "Purchasing Shop",
      p_slug: slug,
      p_country: "IE",
      p_currency: "EUR",
      p_timezone: "Europe/Dublin",
      p_locale: "en-IE",
      p_branch_code: branchCode,
      p_branch_name: "Purchasing Main",
    })
    .single();
  if (error) throw error;
  return data;
}

async function main() {
  const stamp = Date.now();
  const userA = `purch-a-${stamp}@shopos.test`;
  const userB = `purch-b-${stamp}@shopos.test`;
  const password = "TestPass123!";

  console.info("\n[1] Bootstrap two tenants");
  await createTestUser(userA, password);
  await createTestUser(userB, password);
  const a = await getUserClient(userA, password);
  const b = await getUserClient(userB, password);
  const aOnboard = await onboardUser(a.client, `purch-a-${stamp}`, "MAIN");
  const bOnboard = await onboardUser(b.client, `purch-b-${stamp}`, "BRX");
  ok(`tenant A id=${aOnboard.tenant_id.slice(0, 8)} branch=${aOnboard.branch_id.slice(0, 8)}`);

  console.info("\n[2] Seed a supplier + two products for tenant A");
  const { data: supplier, error: supErr } = await a.client
    .from("suppliers")
    .insert({
      tenant_id: aOnboard.tenant_id,
      name: "Acme Wholesale",
      code: `ACME-${stamp.toString().slice(-6)}`,
      country: "IE",
    })
    .select("id")
    .single();
  if (supErr) throw supErr;
  ok(`supplier ${supplier.id.slice(0, 8)}`);

  const { data: p1, error: p1Err } = await a.client
    .from("products")
    .insert({
      tenant_id: aOnboard.tenant_id,
      name: "Coffee Beans 1kg",
      sku: `BEAN-${stamp.toString().slice(-6)}`,
      barcode: `5111111${String(stamp).slice(-6)}`,
      base_unit: "kg",
      purchase_price: 1.0,
      selling_price: 12.0,
      vat_code: "STD",
      vat_included: true,
      is_active: true,
    })
    .select("id, purchase_price")
    .single();
  if (p1Err) throw p1Err;
  const { data: p2, error: p2Err } = await a.client
    .from("products")
    .insert({
      tenant_id: aOnboard.tenant_id,
      name: "Tea Bags 80ct",
      sku: `TEA-${stamp.toString().slice(-6)}`,
      barcode: `5222222${String(stamp).slice(-6)}`,
      base_unit: "un",
      purchase_price: 2.0,
      selling_price: 6.0,
      vat_code: "STD",
      vat_included: true,
      is_active: true,
    })
    .select("id, purchase_price")
    .single();
  if (p2Err) throw p2Err;
  ok(`product1 ${p1.id.slice(0, 8)} (cost=${p1.purchase_price}) + product2 ${p2.id.slice(0, 8)} (cost=${p2.purchase_price})`);

  console.info("\n[3] create_purchase_order with two lines");
  let poId, poNumber;
  {
    const { data, error } = await a.client
      .rpc("create_purchase_order", {
        p_branch_id: aOnboard.branch_id,
        p_supplier_id: supplier.id,
        p_items: [
          { product_id: p1.id, quantity: 10, unit_cost: 1.0, vat_code: "STD" },
          { product_id: p2.id, quantity: 5, unit_cost: 2.0, vat_code: "STD" },
        ],
      })
      .single();
    if (error) {
      bad("create_purchase_order", error.message);
      process.exit(1);
    }
    poId = data.po_id;
    poNumber = data.po_number;
    if (!/^PO-\d{6}$/.test(poNumber)) bad("po_number format", poNumber);
    else ok(`PO ${poNumber}`);
    if (!near(data.subtotal, 20)) bad("PO subtotal", `expected 20.00 got ${data.subtotal}`);
    else ok(`PO subtotal=${data.subtotal}`);
    if (!near(data.vat_total, 4.6)) bad("PO vat_total", `expected 4.60 got ${data.vat_total}`);
    else ok(`PO vat=${data.vat_total}`);
    if (!near(data.total, 24.6)) bad("PO total", `expected 24.60 got ${data.total}`);
    else ok(`PO total=${data.total}`);
  }

  console.info("\n[4] Mark PO as submitted (direct UPDATE via RLS)");
  {
    const { error } = await a.client
      .from("purchase_orders")
      .update({ status: "submitted", ordered_at: new Date().toISOString() })
      .eq("id", poId);
    if (error) bad("mark submitted", error.message);
    else ok("PO -> submitted");
  }

  console.info("\n[5] create_goods_receipt linked to the PO (partial)");
  let gr1Id;
  {
    const { data, error } = await a.client
      .rpc("create_goods_receipt", {
        p_branch_id: aOnboard.branch_id,
        p_supplier_id: supplier.id,
        p_purchase_order_id: poId,
        p_invoice_number: `INV-${stamp}`,
        p_invoice_total: 9.4,
        p_items: [
          { product_id: p1.id, quantity: 8, unit_cost: 1.1, vat_code: "STD" },
          { product_id: p2.id, quantity: 5, unit_cost: 2.0, vat_code: "STD" },
        ],
      })
      .single();
    if (error) {
      bad("create_goods_receipt", error.message);
      process.exit(1);
    }
    gr1Id = data.gr_id;
    if (!/^GR-\d{6}$/.test(data.gr_number)) bad("gr_number format", data.gr_number);
    else ok(`GR ${data.gr_number} (draft)`);
  }

  console.info("\n[6] Draft GR has not changed inventory yet");
  {
    const { data: balances } = await a.client
      .from("stock_balances")
      .select("product_id, quantity")
      .eq("branch_id", aOnboard.branch_id);
    if ((balances ?? []).length === 0) ok("no stock_balances rows yet (draft GR is inert)");
    else bad("draft inert", `found ${balances.length} balances rows pre-finalise`);
  }

  console.info("\n[7] finalise_goods_receipt - applies stock + WAC + PO sync");
  {
    const { data, error } = await a.client
      .rpc("finalise_goods_receipt", { p_gr_id: gr1Id })
      .single();
    if (error) {
      bad("finalise", error.message);
      process.exit(1);
    }
    if (data.items_count !== 2) bad("items_count", `expected 2 got ${data.items_count}`);
    else ok(`finalised, ${data.items_count} lines committed`);
    if (data.po_status !== "partially_received") {
      bad("po_status partial", `expected partially_received got ${data.po_status}`);
    } else {
      ok("PO status -> partially_received");
    }
  }

  console.info("\n[8] stock_balances reflect the receipt");
  {
    const { data: bal } = await a.client
      .from("stock_balances")
      .select("product_id, quantity, state")
      .eq("branch_id", aOnboard.branch_id)
      .eq("state", "available");
    const map = new Map((bal ?? []).map((r) => [r.product_id, Number(r.quantity)]));
    if (map.get(p1.id) === 8 && map.get(p2.id) === 5) {
      ok(`stock_balances: P1=${map.get(p1.id)}, P2=${map.get(p2.id)}`);
    } else {
      bad(
        "stock_balances",
        `expected P1=8 P2=5, got P1=${map.get(p1.id)} P2=${map.get(p2.id)}`,
      );
    }
  }

  console.info("\n[9] stock_ledger has two goods_receipt rows for this GR");
  {
    const { data: ledger } = await a.client
      .from("stock_ledger")
      .select("movement_type, quantity, reference_type, reference_id, product_id")
      .eq("reference_type", "goods_receipt")
      .eq("reference_id", gr1Id);
    if ((ledger ?? []).length !== 2) bad("ledger rows", `expected 2 got ${ledger?.length}`);
    else ok(`ledger has ${ledger.length} goods_receipt rows`);
    if ((ledger ?? []).length > 0 && ledger.every((r) => r.movement_type === "goods_receipt"))
      ok("all rows tagged goods_receipt");
    else bad("ledger types", "found a non-goods_receipt row");
  }

  console.info("\n[10] WAC: with no prior stock, new cost == receipt unit cost");
  {
    const { data: prod } = await a.client
      .from("products")
      .select("id, purchase_price")
      .in("id", [p1.id, p2.id]);
    const map = new Map((prod ?? []).map((p) => [p.id, Number(p.purchase_price)]));
    if (near(map.get(p1.id), 1.1)) ok(`P1 cost: 1.00 -> ${map.get(p1.id).toFixed(4)} (= 1.10)`);
    else bad("P1 WAC empty-balance", `expected 1.1000 got ${map.get(p1.id)}`);
    if (near(map.get(p2.id), 2.0)) ok(`P2 cost stayed at 2.00 (no change)`);
    else bad("P2 WAC empty-balance", `expected 2.0000 got ${map.get(p2.id)}`);
  }

  console.info("\n[11] PO line received quantities + outstanding");
  {
    const { data: items } = await a.client
      .from("purchase_order_items")
      .select("product_id, quantity, qty_received, qty_outstanding")
      .eq("purchase_order_id", poId);
    const map = new Map((items ?? []).map((it) => [it.product_id, it]));
    const it1 = map.get(p1.id);
    const it2 = map.get(p2.id);
    if (Number(it1?.qty_received) === 8 && Number(it1?.qty_outstanding) === 2) {
      ok(`P1 line: ordered=10 received=8 outstanding=2`);
    } else {
      bad("P1 PO line", `received=${it1?.qty_received} outstanding=${it1?.qty_outstanding}`);
    }
    if (Number(it2?.qty_received) === 5 && Number(it2?.qty_outstanding) === 0) {
      ok(`P2 line: ordered=5 received=5 outstanding=0`);
    } else {
      bad("P2 PO line", `received=${it2?.qty_received} outstanding=${it2?.qty_outstanding}`);
    }
  }

  console.info("\n[12] Second GR for remaining 2 of P1 at higher cost - WAC blends");
  let gr2Id;
  {
    const { data, error } = await a.client
      .rpc("create_goods_receipt", {
        p_branch_id: aOnboard.branch_id,
        p_supplier_id: supplier.id,
        p_purchase_order_id: poId,
        p_items: [{ product_id: p1.id, quantity: 2, unit_cost: 1.5, vat_code: "STD" }],
      })
      .single();
    if (error) {
      bad("second GR create", error.message);
      process.exit(1);
    }
    gr2Id = data.gr_id;
    ok(`second GR ${data.gr_number} (draft)`);
  }
  {
    const { data, error } = await a.client
      .rpc("finalise_goods_receipt", { p_gr_id: gr2Id })
      .single();
    if (error) {
      bad("second GR finalise", error.message);
      process.exit(1);
    }
    if (data.po_status !== "received") {
      bad("PO -> received", `expected 'received' got ${data.po_status}`);
    } else {
      ok("PO status -> received (all lines fulfilled)");
    }
  }
  {
    const { data: prod } = await a.client
      .from("products")
      .select("purchase_price")
      .eq("id", p1.id)
      .single();
    // WAC = (8 * 1.10 + 2 * 1.50) / 10 = (8.80 + 3.00) / 10 = 1.18
    if (near(prod.purchase_price, 1.18)) {
      ok(`WAC blend: (8 * 1.10 + 2 * 1.50) / 10 = 1.1800 (got ${Number(prod.purchase_price).toFixed(4)})`);
    } else {
      bad("WAC blend", `expected 1.1800 got ${Number(prod.purchase_price).toFixed(4)}`);
    }
  }

  console.info("\n[13] stock_balances reflect the cumulative receipts");
  {
    const { data: bal } = await a.client
      .from("stock_balances")
      .select("product_id, quantity")
      .eq("branch_id", aOnboard.branch_id)
      .eq("state", "available");
    const map = new Map((bal ?? []).map((r) => [r.product_id, Number(r.quantity)]));
    if (map.get(p1.id) === 10 && map.get(p2.id) === 5) {
      ok(`stock_balances: P1=${map.get(p1.id)}, P2=${map.get(p2.id)}`);
    } else {
      bad(
        "balances after second GR",
        `expected P1=10 P2=5, got P1=${map.get(p1.id)} P2=${map.get(p2.id)}`,
      );
    }
  }

  console.info("\n[14] Finalising an already-finalised GR is rejected");
  {
    const { error } = await a.client.rpc("finalise_goods_receipt", { p_gr_id: gr1Id });
    if (!error) bad("double finalise", "no error");
    else if (/not draft|finalised/i.test(error.message)) ok("rejected with clear message");
    else bad("double finalise message", error.message);
  }

  console.info("\n[15] RLS: user B cannot see or modify user A's PO or GR");
  {
    const { data: list } = await b.client.from("purchase_orders").select("id").eq("id", poId);
    if ((list ?? []).length === 0) ok("user B cannot select user A's PO");
    else bad("RLS PO select", `user B saw ${list.length} PO rows`);
  }
  {
    const { data: list } = await b.client.from("goods_receipts").select("id").eq("id", gr1Id);
    if ((list ?? []).length === 0) ok("user B cannot select user A's GR");
    else bad("RLS GR select", `user B saw ${list.length} GR rows`);
  }
  {
    const { error } = await b.client.rpc("finalise_goods_receipt", { p_gr_id: gr2Id });
    if (!error) bad("RLS finalise", "no error");
    else ok("user B cannot finalise user A's GR");
  }
  {
    // user B trying to create a PO that references user A's branch + supplier
    const { error } = await b.client.rpc("create_purchase_order", {
      p_branch_id: aOnboard.branch_id,
      p_supplier_id: supplier.id,
      p_items: [{ product_id: p1.id, quantity: 1, unit_cost: 1, vat_code: "STD" }],
    });
    if (!error) bad("RLS create PO", "no error");
    else ok("user B cannot create PO against user A's branch");
  }

  console.info("\n[16] Cleanup");
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
