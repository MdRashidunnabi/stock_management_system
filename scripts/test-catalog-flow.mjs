#!/usr/bin/env node
/**
 * Live end-to-end test of the Step 7 catalog CRUD against the local
 * Supabase stack (http://127.0.0.1:54321).
 *
 * Verifies, in order:
 *   1.  A fresh auth user is created and onboarded with create_tenant_with_owner.
 *   2.  Categories: insert / select / update / archive / restore as owner.
 *   3.  Brands: insert / update / archive / restore.
 *   4.  Suppliers: insert / update / archive / restore.
 *   5.  Products: insert with refs to category/brand/supplier; update; archive; restore.
 *   6.  Bulk product insert (simulating CSV import) - 5 rows in one statement.
 *   7.  RLS enforcement: a second tenant user cannot see the first tenant's data.
 *   8.  RLS enforcement: a second tenant user cannot UPDATE the first tenant's data.
 *
 * Cleanup: tenants are deleted (cascades to all child tables) and the auth users removed.
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
    user_metadata: { full_name: "Catalog Test" },
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

async function onboardUser(c, slug) {
  const { data, error } = await c
    .rpc("create_tenant_with_owner", {
      p_legal_name: "Catalog Test Ltd",
      p_display_name: "Catalog Test Shop",
      p_slug: slug,
      p_country: "IE",
      p_currency: "EUR",
      p_timezone: "Europe/Dublin",
      p_locale: "en-IE",
      p_branch_code: "MAIN",
      p_branch_name: "Catalog Main",
    })
    .single();
  if (error) throw error;
  return data;
}

async function main() {
  const stamp = Date.now();
  const userA = `cat-a-${stamp}@shopos.test`;
  const userB = `cat-b-${stamp}@shopos.test`;
  const password = "TestPass123!";
  const slugA = `catalog-a-${stamp}`;
  const slugB = `catalog-b-${stamp}`;

  console.info("\n[1] Bootstrap two onboarded tenants");
  const aUser = await createTestUser(userA, password);
  const bUser = await createTestUser(userB, password);
  const a = await getUserClient(userA, password);
  const b = await getUserClient(userB, password);
  const aOnboard = await onboardUser(a.client, slugA);
  const bOnboard = await onboardUser(b.client, slugB);
  ok(`tenant A id=${aOnboard.tenant_id.slice(0, 8)}`);
  ok(`tenant B id=${aOnboard.tenant_id !== bOnboard.tenant_id ? bOnboard.tenant_id.slice(0, 8) : "DUP!"}`);

  /* ============================== Categories ============================== */

  console.info("\n[2] Categories CRUD as owner A");
  let categoryId;
  {
    const { data, error } = await a.client
      .from("categories")
      .insert({
        tenant_id: aOnboard.tenant_id,
        name: "Beverages",
        slug: `beverages-${stamp}`,
        position: 1,
      })
      .select("id, name, slug, position, is_active")
      .single();
    if (error) bad("insert category", error.message);
    else {
      categoryId = data.id;
      ok(`insert category id=${data.id.slice(0, 8)} slug=${data.slug}`);
    }
  }
  {
    const { data, error } = await a.client.from("categories").select("id, name").eq("id", categoryId);
    if (error) bad("select category", error.message);
    else if (!data?.length) bad("select category", "no rows");
    else ok(`select category (${data[0].name})`);
  }
  {
    const { error } = await a.client
      .from("categories")
      .update({ name: "Drinks & Beverages", position: 5 })
      .eq("id", categoryId);
    if (error) bad("update category", error.message);
    else ok("update category");
  }
  {
    const { error } = await a.client
      .from("categories")
      .update({ is_active: false })
      .eq("id", categoryId);
    if (error) bad("archive category", error.message);
    else ok("archive category");
  }
  {
    const { error } = await a.client
      .from("categories")
      .update({ is_active: true })
      .eq("id", categoryId);
    if (error) bad("restore category", error.message);
    else ok("restore category");
  }

  /* ================================ Brands ================================ */

  console.info("\n[3] Brands CRUD as owner A");
  let brandId;
  {
    const { data, error } = await a.client
      .from("brands")
      .insert({
        tenant_id: aOnboard.tenant_id,
        name: "Tayto",
        slug: `tayto-${stamp}`,
      })
      .select("id, name")
      .single();
    if (error) bad("insert brand", error.message);
    else {
      brandId = data.id;
      ok(`insert brand id=${data.id.slice(0, 8)}`);
    }
  }
  {
    const { error } = await a.client
      .from("brands")
      .update({ name: "Tayto Foods" })
      .eq("id", brandId);
    if (error) bad("update brand", error.message);
    else ok("update brand");
  }
  {
    const { error } = await a.client
      .from("brands")
      .update({ is_active: false })
      .eq("id", brandId);
    if (error) bad("archive brand", error.message);
    else ok("archive brand");

    const { error: r } = await a.client
      .from("brands")
      .update({ is_active: true })
      .eq("id", brandId);
    if (r) bad("restore brand", r.message);
    else ok("restore brand");
  }

  /* ============================== Suppliers ============================== */

  console.info("\n[4] Suppliers CRUD as owner A");
  let supplierId;
  {
    const { data, error } = await a.client
      .from("suppliers")
      .insert({
        tenant_id: aOnboard.tenant_id,
        code: `WS-${stamp}`,
        name: "Demo Wholesale",
        contact_name: "Sean Murphy",
        email: "sean@demo.test",
        phone: "+353 1 555 0001",
        address_line1: "1 Wholesale Way",
        city: "Dublin",
        county: "Dublin",
        eircode: "D07 XY99",
        country: "IE",
        payment_terms: "Net 30",
        default_lead_time_days: 5,
      })
      .select("id, code, name")
      .single();
    if (error) bad("insert supplier", error.message);
    else {
      supplierId = data.id;
      ok(`insert supplier id=${data.id.slice(0, 8)} code=${data.code}`);
    }
  }
  {
    const { error } = await a.client
      .from("suppliers")
      .update({ payment_terms: "Net 14", default_lead_time_days: 3 })
      .eq("id", supplierId);
    if (error) bad("update supplier", error.message);
    else ok("update supplier");
  }
  {
    const { error: a1 } = await a.client
      .from("suppliers")
      .update({ is_active: false })
      .eq("id", supplierId);
    if (a1) bad("archive supplier", a1.message);
    else ok("archive supplier");
    const { error: a2 } = await a.client
      .from("suppliers")
      .update({ is_active: true })
      .eq("id", supplierId);
    if (a2) bad("restore supplier", a2.message);
    else ok("restore supplier");
  }

  /* =============================== Products =============================== */

  console.info("\n[5] Products CRUD as owner A");
  let productId;
  {
    const { data, error } = await a.client
      .from("products")
      .insert({
        tenant_id: aOnboard.tenant_id,
        name: "Tayto Cheese & Onion 45g",
        sku: `TAY-CO-${stamp}`,
        barcode: `5012345${String(stamp).slice(-7)}`,
        category_id: categoryId,
        brand_id: brandId,
        default_supplier_id: supplierId,
        purchase_price: 0.45,
        selling_price: 1.2,
        vat_code: "STD",
        vat_included: true,
        base_unit: "un",
      })
      .select("id, name, sku, selling_price")
      .single();
    if (error) bad("insert product", error.message);
    else {
      productId = data.id;
      ok(`insert product id=${data.id.slice(0, 8)} sku=${data.sku}`);
    }
  }

  // Verify joins through RLS work
  {
    const { data, error } = await a.client
      .from("products")
      .select("id, name, category:categories(name), brand:brands(name), supplier:suppliers!default_supplier_id(name)")
      .eq("id", productId)
      .single();
    if (error) bad("select product with joins", error.message);
    else if (
      data.category?.name !== "Drinks & Beverages" ||
      data.brand?.name !== "Tayto Foods" ||
      data.supplier?.name !== "Demo Wholesale"
    ) {
      bad(
        "joins return correct rows",
        JSON.stringify({ cat: data.category, br: data.brand, sup: data.supplier }),
      );
    } else {
      ok("select product with category/brand/supplier joins");
    }
  }

  {
    const { error } = await a.client
      .from("products")
      .update({ selling_price: 1.35, purchase_price: 0.5 })
      .eq("id", productId);
    if (error) bad("update product price (triggers price history)", error.message);
    else ok("update product price (triggers price history)");
  }

  {
    const { data: hist } = await a.client
      .from("product_price_history")
      .select("field, old_value, new_value")
      .eq("product_id", productId)
      .order("changed_at", { ascending: true });
    if (!hist?.length) bad("price history captured", "no rows");
    else ok(`price history captured (${hist.length} rows)`);
  }

  {
    const { error: ar } = await a.client
      .from("products")
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq("id", productId);
    if (ar) bad("archive product", ar.message);
    else ok("archive product");
    const { error: re } = await a.client
      .from("products")
      .update({ is_active: true, archived_at: null })
      .eq("id", productId);
    if (re) bad("restore product", re.message);
    else ok("restore product");
  }

  /* ============================ Bulk insert ============================ */

  console.info("\n[6] Bulk insert (simulates CSV import - 5 rows)");
  {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      tenant_id: aOnboard.tenant_id,
      name: `Bulk Product ${i + 1}`,
      sku: `BULK-${stamp}-${i + 1}`,
      barcode: `9${String(stamp + i).slice(-12)}`,
      purchase_price: i * 0.5 + 0.1,
      selling_price: i * 0.5 + 0.5,
      vat_code: "STD",
      vat_included: true,
      base_unit: "un",
      is_active: true,
    }));
    const { data, error } = await a.client.from("products").insert(rows).select("id");
    if (error) bad("bulk insert 5 products", error.message);
    else if (data?.length !== 5) bad("bulk insert 5 products", `expected 5, got ${data?.length}`);
    else ok(`bulk insert 5 products`);
  }

  /* =============================== RLS =============================== */

  console.info("\n[7] RLS - user B cannot see user A's tenant data");
  {
    const { data: cats } = await b.client.from("categories").select("id").eq("id", categoryId);
    if (cats?.length) bad("category invisible to other tenant", `leaked ${cats.length} rows`);
    else ok("category invisible to other tenant");

    const { data: prods } = await b.client.from("products").select("id").eq("id", productId);
    if (prods?.length) bad("product invisible to other tenant", `leaked ${prods.length} rows`);
    else ok("product invisible to other tenant");

    const { data: sups } = await b.client.from("suppliers").select("id").eq("id", supplierId);
    if (sups?.length) bad("supplier invisible to other tenant", `leaked ${sups.length} rows`);
    else ok("supplier invisible to other tenant");
  }

  console.info("\n[8] RLS - user B cannot UPDATE user A's data");
  {
    const { data, error } = await b.client
      .from("products")
      .update({ name: "HIJACKED" })
      .eq("id", productId)
      .select("id");
    // Postgres RLS makes this return zero affected rows rather than an error.
    if (data && data.length > 0) {
      bad("RLS blocks cross-tenant UPDATE", `updated ${data.length} rows!`);
    } else if (error && error.code !== "PGRST116") {
      // some libraries surface this as an error - either way is fine
      ok(`RLS blocks cross-tenant UPDATE (${error.code})`);
    } else {
      ok("RLS blocks cross-tenant UPDATE (zero rows affected)");
    }

    // confirm via admin that the row was NOT modified
    const { data: row } = await admin.from("products").select("name").eq("id", productId).single();
    if (row?.name === "HIJACKED") bad("name was not modified", "RLS leaked!");
    else ok("name was not modified by other tenant");
  }

  /* ============================== Cleanup ============================== */

  console.info("\n[9] Cleanup");
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
  console.error("[test-catalog-flow] crashed:", e);
  process.exit(1);
});
