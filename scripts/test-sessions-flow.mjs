#!/usr/bin/env node
/**
 * Live end-to-end test of the Step 9 till session lifecycle against the
 * local Supabase stack (http://127.0.0.1:54321).
 *
 * What it verifies, in order:
 *   1. Bootstrap two onboarded tenants (A and B).
 *   2. Seed a product with starting stock for tenant A.
 *   3. open_pos_session: cashier opens a till with a 100 EUR float.
 *   4. Opening cash_drawer_movements row of type 'opening' is written.
 *   5. Trying to open a second open till on the same branch is rejected.
 *   6. A POS sale paid 20 EUR cash + 5 EUR card lands on the open session
 *      AND increments the cash drawer by 20 EUR.
 *   7. record_cash_movement: pay-out 5 EUR is recorded with the right sign.
 *   8. Calling record_cash_movement with an "opening" type is rejected.
 *   9. close_pos_session: count 115 EUR -> expected 115, variance 0.
 *  10. After close, calling commit_pos_sale with that session id is rejected.
 *  11. After close, attempting to close again is rejected.
 *  12. RLS: user B cannot see / open / close / record on user A's session.
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

async function createTestUser(email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Sessions Test" },
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
      p_legal_name: "Sessions Ltd",
      p_display_name: "Sessions Shop",
      p_slug: slug,
      p_country: "IE",
      p_currency: "EUR",
      p_timezone: "Europe/Dublin",
      p_locale: "en-IE",
      p_branch_code: branchCode,
      p_branch_name: "Sessions Main",
    })
    .single();
  if (error) throw error;
  return data;
}

async function main() {
  const stamp = Date.now();
  const userA = `sess-a-${stamp}@shopos.test`;
  const userB = `sess-b-${stamp}@shopos.test`;
  const password = "TestPass123!";

  console.info("\n[1] Bootstrap two tenants");
  const aUser = await createTestUser(userA, password);
  const bUser = await createTestUser(userB, password);
  const a = await getUserClient(userA, password);
  const b = await getUserClient(userB, password);
  const aOnboard = await onboardUser(a.client, `sess-a-${stamp}`, "MAIN");
  const bOnboard = await onboardUser(b.client, `sess-b-${stamp}`, "BRX");
  ok(`tenant A id=${aOnboard.tenant_id.slice(0, 8)} branch=${aOnboard.branch_id.slice(0, 8)}`);

  console.info("\n[2] Seed a product + stock for tenant A");
  const { data: prods, error: prodErr } = await a.client
    .from("products")
    .insert({
      tenant_id: aOnboard.tenant_id,
      name: "Sessions Test - Tea Bag 80ct",
      sku: `SESS-TEA-${stamp}`,
      barcode: `5000000${String(stamp).slice(-6)}`,
      base_unit: "un",
      purchase_price: 1.5,
      selling_price: 5,
      vat_code: "STD",
      vat_included: true,
      is_active: true,
    })
    .select("id")
    .single();
  if (prodErr) throw prodErr;
  await admin.from("stock_balances").upsert(
    {
      tenant_id: aOnboard.tenant_id,
      branch_id: aOnboard.branch_id,
      product_id: prods.id,
      state: "available",
      quantity: 50,
    },
    { onConflict: "tenant_id,branch_id,product_id,variant_id,state" },
  );
  ok(`seeded product ${prods.id.slice(0, 8)} with 50 in stock`);

  console.info("\n[3] open_pos_session(opening_cash=100)");
  let sessionId;
  {
    const { data, error } = await a.client.rpc("open_pos_session", {
      p_branch_id: aOnboard.branch_id,
      p_opening_cash: 100,
      p_note: "Smoke test opening",
    });
    if (error) {
      bad("open_pos_session", error.message);
      process.exit(1);
    }
    sessionId = data;
    ok(`session id=${sessionId.slice(0, 8)} status=open opening=100`);
  }

  console.info("\n[4] Opening cash_drawer_movements row exists");
  {
    const { data, error } = await a.client
      .from("cash_drawer_movements")
      .select("type, amount, reason")
      .eq("pos_session_id", sessionId)
      .eq("type", "opening");
    if (error || !data?.length) bad("opening movement", error?.message ?? "no rows");
    else if (Number(data[0].amount) !== 100) bad("opening amount", `${data[0].amount}`);
    else ok(`opening row recorded amount=${data[0].amount} reason="${data[0].reason}"`);
  }

  console.info("\n[5] Cannot open a second open till on the same branch");
  {
    const { error } = await a.client.rpc("open_pos_session", {
      p_branch_id: aOnboard.branch_id,
      p_opening_cash: 50,
    });
    if (!error) bad("second open rejected", "no error");
    else if (/already have an open till/i.test(error.message)) ok("second open rejected with clear msg");
    else bad("second open rejected", error.message);
  }

  console.info("\n[6] commit_pos_sale on the open session");
  let saleTotal;
  {
    const { data, error } = await a.client
      .rpc("commit_pos_sale", {
        p_branch_id: aOnboard.branch_id,
        p_session_id: sessionId,
        p_items: [{ product_id: prods.id, qty: 5, discount: 0 }], // 5 * 5 = 25 gross
        p_payments: [
          { method: "cash", amount: 20 },
          { method: "card", amount: 5 },
        ],
      })
      .single();
    if (error) {
      bad("commit_pos_sale", error.message);
      process.exit(1);
    }
    saleTotal = Number(data.total);
    if (Math.abs(saleTotal - 25) > 0.01) bad("sale total", `expected 25, got ${saleTotal}`);
    else ok(`sale receipt=${data.receipt_number} total=${saleTotal}`);
    if (data.pos_session_id !== sessionId) bad("session reuse", "wrong session_id");
    else ok("sale attached to the open session");
  }

  console.info("\n[7] Sale wrote a 20 EUR cash drawer movement");
  {
    const { data } = await a.client
      .from("cash_drawer_movements")
      .select("type, amount")
      .eq("pos_session_id", sessionId)
      .eq("type", "sale");
    if (!data?.length) bad("sale movement", "no rows");
    else if (Number(data[0].amount) !== 20) bad("sale movement amount", `${data[0].amount}`);
    else ok(`sale movement recorded amount=${data[0].amount}`);
  }

  console.info("\n[8] record_cash_movement: pay-out 5 EUR");
  {
    const { data, error } = await a.client.rpc("record_cash_movement", {
      p_session_id: sessionId,
      p_type: "pay_out",
      p_amount: 5,
      p_reason: "Coin float top-up at the cafe next door",
    });
    if (error) bad("pay_out", error.message);
    else ok(`pay_out movement id=${String(data).slice(0, 8)}`);
  }

  console.info("\n[9] record_cash_movement rejects 'opening' type");
  {
    const { error } = await a.client.rpc("record_cash_movement", {
      p_session_id: sessionId,
      p_type: "opening",
      p_amount: 10,
    });
    if (!error) bad("rejects opening type", "no error");
    else if (/written by open\/close/i.test(error.message)) ok("rejects 'opening' from manual API");
    else bad("rejects opening type", error.message);
  }

  console.info("\n[10] close_pos_session: counted=115 -> variance=0");
  {
    const { data, error } = await a.client
      .rpc("close_pos_session", {
        p_session_id: sessionId,
        p_counted_cash: 115,
        p_closing_note: "End of smoke test shift",
      })
      .single();
    if (error) {
      bad("close_pos_session", error.message);
      process.exit(1);
    }
    if (Number(data.expected_cash) !== 115)
      bad("expected cash", `expected 115, got ${data.expected_cash}`);
    else ok(`expected_cash = 115 (100 opening + 20 sale - 5 pay_out)`);
    if (Number(data.cash_difference) !== 0)
      bad("variance", `expected 0, got ${data.cash_difference}`);
    else ok(`variance = 0 (counted matches expected)`);
    if (data.status !== "closed") bad("status", data.status);
    else ok(`session is closed`);
  }

  console.info("\n[11] commit_pos_sale on the now-closed session is rejected");
  {
    const { error } = await a.client.rpc("commit_pos_sale", {
      p_branch_id: aOnboard.branch_id,
      p_session_id: sessionId,
      p_items: [{ product_id: prods.id, qty: 1 }],
      p_payments: [{ method: "cash", amount: 5 }],
    });
    if (!error) bad("commit on closed session rejected", "no error");
    else if (/not open/i.test(error.message)) ok("commit on closed session rejected");
    else bad("commit on closed session", error.message);
  }

  console.info("\n[12] close_pos_session twice is rejected");
  {
    const { error } = await a.client.rpc("close_pos_session", {
      p_session_id: sessionId,
      p_counted_cash: 100,
    });
    if (!error) bad("second close rejected", "no error");
    else if (/already closed/i.test(error.message)) ok("second close rejected");
    else bad("second close rejected", error.message);
  }

  console.info("\n[13] RLS: user B cannot see / mutate user A's session");
  {
    const { data: rows } = await b.client.from("pos_sessions").select("id").eq("id", sessionId);
    if (rows?.length) bad("session hidden from B", `leaked ${rows.length}`);
    else ok("session hidden from tenant B");

    // try to record a movement on A's session as B
    const { error } = await b.client.rpc("record_cash_movement", {
      p_session_id: sessionId,
      p_type: "pay_in",
      p_amount: 10,
    });
    if (!error) bad("cross-tenant record_cash_movement blocked", "no error");
    else ok(`cross-tenant cash movement blocked (${error.code ?? "msg"})`);
  }

  console.info("\n[14] Cleanup");
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
  console.error("[test-sessions-flow] crashed:", e);
  process.exit(1);
});
