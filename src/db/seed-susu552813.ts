/**
 * Demo shop owner "susu552813" — 1 shop, 5 branches, trial + demo card.
 *
 * Run: npm run db:seed:susu552813
 *
 * Login:
 *   owner@susu552813.shopos.local / DemoPass123!
 *
 * Then: Settings → Team (invite staff), Branches, Billing, /shop/susu552813 (branch picker)
 */
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { calculateMonthlyCents } from "@/lib/billing/plans";

const OWNER_EMAIL = "owner@susu552813.shopos.local";
const PASSWORD = "DemoPass123!";
const SLUG = "susu552813";
const DISPLAY_NAME = "Susu552813 Demo Shop";
const LEGAL_NAME = "Susu552813 Retail Ltd";

const BRANCHES = [
  { code: "MAIN", name: "Main Street", city: "Dublin" },
  { code: "NORTH", name: "Northside", city: "Dublin" },
  { code: "SOUTH", name: "Southside", city: "Dublin" },
  { code: "WEST", name: "Westend", city: "Galway" },
  { code: "EAST", name: "Eastpoint", city: "Cork" },
] as const;

const SAMPLE_PRODUCTS = [
  { sku: "SUSU-001", name: "Fresh Milk 2L", price: 2.49 },
  { sku: "SUSU-002", name: "Brown Bread", price: 1.89 },
  { sku: "SUSU-003", name: "Chicken Fillet 1kg", price: 8.99 },
  { sku: "SUSU-004", name: "Bananas 1kg", price: 1.49 },
  { sku: "SUSU-005", name: "Still Water 6pk", price: 3.99 },
];

async function ensureAuthUser(
  admin: SupabaseClient,
  email: string,
  fullName: string,
): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return data.user.id;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const monthlyCents = calculateMonthlyCents(1, 5);

  console.info("[susu552813] creating owner…");
  const ownerId = await ensureAuthUser(admin, OWNER_EMAIL, "Susu552813 Owner");

  const { data: existingTenant } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();

  let tenantId = existingTenant?.id;

  if (!tenantId) {
    const { data: billing, error: bErr } = await admin
      .from("billing_accounts")
      .upsert(
        {
          owner_user_id: ownerId,
          plan_shop_tier: 1,
          plan_branch_tier: 5,
          licensed_shop_count: 1,
          licensed_branch_count: 5,
          monthly_amount_cents: monthlyCents,
          provider: "demo",
          card_on_file: true,
          card_last4: "4242",
          card_brand: "visa",
        },
        { onConflict: "owner_user_id" },
      )
      .select("id")
      .single();
    if (bErr) throw bErr;

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    const { data: tenant, error: tErr } = await admin
      .from("tenants")
      .insert({
        slug: SLUG,
        legal_name: LEGAL_NAME,
        display_name: DISPLAY_NAME,
        country: "IE",
        currency: "EUR",
        timezone: "Europe/Dublin",
        default_locale: "en-IE",
        status: "trial",
        trial_ends_at: trialEnd.toISOString(),
        billing_account_id: billing.id,
        created_by: ownerId,
        updated_by: ownerId,
      })
      .select("id")
      .single();
    if (tErr) throw tErr;
    tenantId = tenant.id;

    await admin.from("user_tenants").upsert(
      {
        user_id: ownerId,
        tenant_id: tenantId,
        role: "owner",
        branch_id: null,
        is_active: true,
        accepted_at: new Date().toISOString(),
      },
      { onConflict: "user_id,tenant_id,role,branch_id" },
    );
  } else {
    await admin
      .from("billing_accounts")
      .update({
        plan_shop_tier: 1,
        plan_branch_tier: 5,
        licensed_shop_count: 1,
        licensed_branch_count: 5,
        monthly_amount_cents: monthlyCents,
        card_on_file: true,
        card_last4: "4242",
        card_brand: "visa",
      })
      .eq("owner_user_id", ownerId);
  }

  const branchIds: string[] = [];
  for (const b of BRANCHES) {
    const { data: row } = await admin
      .from("branches")
      .select("id")
      .eq("tenant_id", tenantId!)
      .eq("code", b.code)
      .maybeSingle();

    if (row?.id) {
      branchIds.push(row.id);
      continue;
    }

    const { data: inserted, error } = await admin
      .from("branches")
      .insert({
        tenant_id: tenantId,
        code: b.code,
        name: b.name,
        city: b.city,
        country: "IE",
        timezone: "Europe/Dublin",
        is_active: true,
        created_by: ownerId,
        updated_by: ownerId,
      })
      .select("id")
      .single();
    if (error) throw error;
    branchIds.push(inserted.id);
  }

  const mainBranchId = branchIds[0]!;

  await admin.from("tenant_storefronts").upsert(
    {
      tenant_id: tenantId,
      branch_id: mainBranchId,
      enabled: true,
      hero_title: DISPLAY_NAME,
      hero_subtitle: "Choose your nearest branch — stock may vary by location",
      order_notice: "We will confirm your order by phone.",
      public_site_name: DISPLAY_NAME,
    },
    { onConflict: "tenant_id" },
  );

  await admin.from("tenant_billing").upsert(
    {
      tenant_id: tenantId,
      provider: "demo",
      plan_code: "shops-1-branches-5",
      monthly_amount_cents: monthlyCents,
      card_on_file: true,
      card_last4: "4242",
      card_brand: "visa",
    },
    { onConflict: "tenant_id" },
  );

  let { data: catRow } = await admin
    .from("categories")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("slug", "groceries")
    .maybeSingle();

  if (!catRow) {
    const { data: inserted, error: catErr } = await admin
      .from("categories")
      .insert({
        tenant_id: tenantId,
        name: "Groceries",
        slug: "groceries",
        position: 1,
        is_active: true,
        created_by: ownerId,
        updated_by: ownerId,
      })
      .select("id")
      .single();
    if (catErr) throw catErr;
    catRow = inserted;
  }

  const finalCatId = catRow!.id;

  for (const p of SAMPLE_PRODUCTS) {
    let { data: existing } = await admin
      .from("products")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("sku", p.sku)
      .maybeSingle();

    if (!existing) {
      const { data: inserted, error: pErr } = await admin
        .from("products")
        .insert({
          tenant_id: tenantId,
          sku: p.sku,
          name: p.name,
          selling_price: p.price,
          purchase_price: p.price * 0.6,
          base_unit: "each",
          category_id: finalCatId,
          is_active: true,
          online_visible: true,
          created_by: ownerId,
          updated_by: ownerId,
        })
        .select("id")
        .single();
      if (pErr) throw pErr;
      existing = inserted;
    }

    const productId = existing.id;

    for (let i = 0; i < branchIds.length; i++) {
      const qty = 40 - i * 5;
      const { data: bal } = await admin
        .from("stock_balances")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("branch_id", branchIds[i]!)
        .eq("product_id", productId)
        .eq("state", "available")
        .maybeSingle();

      if (bal) {
        await admin.from("stock_balances").update({ quantity: qty }).eq("id", bal.id);
      } else {
        await admin.from("stock_balances").insert({
          tenant_id: tenantId,
          branch_id: branchIds[i],
          product_id: productId,
          state: "available",
          quantity: qty,
        });
      }
    }
  }

  const { data: existingTerm } = await admin
    .from("pos_terminals")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("branch_id", mainBranchId)
    .limit(1)
    .maybeSingle();

  if (!existingTerm) {
    await admin.from("pos_terminals").insert({
      tenant_id: tenantId,
      branch_id: mainBranchId,
      name: "Till 1",
      code: "TILL1",
      is_active: true,
    });
  }

  console.info("\n[susu552813] Demo shop ready\n");
  console.info("  Shop URL:     http://localhost:3000/shop/" + SLUG);
  console.info("  Owner login:  http://localhost:3000/login");
  console.info("  Email:        " + OWNER_EMAIL);
  console.info("  Password:     " + PASSWORD);
  console.info("  Branches:     " + BRANCHES.map((b) => b.name).join(", "));
  console.info("\n  Try in the app:");
  console.info("    • Settings → Team — invite manager / cashier / accountant (pick a branch)");
  console.info("    • Settings → Branches — see all 5 locations");
  console.info("    • Settings → Billing — plan: 1 shop, up to 5 branches");
  console.info("    • Open shop website — use branch picker at top\n");
}

main().catch((e) => {
  console.error("[susu552813] failed:", e);
  process.exit(1);
});
