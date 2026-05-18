/**
 * Playwright fixtures for the POS critical-path tests.
 *
 * Each test gets a freshly-onboarded tenant + an authed test user so
 * tests are fully isolated from each other. The fixture deletes the
 * tenant cascade and the auth user when the test finishes, keeping the
 * local Supabase database clean.
 *
 * The fixture talks to Supabase directly via its admin API (service
 * role) for setup and teardown - the same pattern used by the smoke
 * scripts under `scripts/test-*.mjs`.
 */
import { test as base, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  // local Supabase well-known key
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export interface SeededProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  selling_price: number;
}

export interface PosFixture {
  email: string;
  password: string;
  tenantId: string;
  branchId: string;
  userId: string;
  product: SeededProduct;
  /** Sign in via the UI and land on the dashboard. */
  signIn: (page: Page) => Promise<void>;
}

const admin: SupabaseClient = createClient(SB_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function userClient(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(SB_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

async function bootstrap(): Promise<{
  email: string;
  password: string;
  tenantId: string;
  branchId: string;
  userId: string;
  product: SeededProduct;
}> {
  const stamp = Date.now();
  const email = `e2e-pos-${stamp}@shopos.test`;
  const password = "Sup3rSecure!Pw1";

  // 1. Create the user.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "E2E POS Cashier" },
  });
  if (createErr) throw createErr;
  const userId = created.user!.id;

  // 2. Onboard the tenant via the same RPC the wizard uses, so the test
  //    isn't coupled to the wizard UI's exact field labels.
  const c = await userClient(email, password);
  const slug = `e2e-pos-${stamp}`;
  const { data: onboarded, error: onbErr } = await c
    .rpc("create_tenant_with_owner", {
      p_legal_name: "POS E2E Ltd",
      p_display_name: "POS E2E Shop",
      p_slug: slug,
      p_country: "IE",
      p_currency: "EUR",
      p_timezone: "Europe/Dublin",
      p_locale: "en-IE",
      p_branch_code: "MAIN",
      p_branch_name: "POS E2E Main",
    })
    .single<{ tenant_id: string; branch_id: string }>();
  if (onbErr) throw onbErr;

  const tenantId = onboarded!.tenant_id;
  const branchId = onboarded!.branch_id;

  // 3. Seed one product so the search has something to find.
  const product: SeededProduct = {
    id: "",
    name: `E2E Cola ${stamp}`,
    sku: `E2E-COLA-${stamp}`,
    barcode: `5000${String(stamp).slice(-9)}`,
    selling_price: 1.5,
  };
  const { data: prods, error: prodErr } = await c
    .from("products")
    .insert({
      tenant_id: tenantId,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      base_unit: "un",
      purchase_price: 0.4,
      selling_price: product.selling_price,
      vat_code: "STD",
      vat_included: true,
      is_active: true,
    })
    .select("id")
    .single<{ id: string }>();
  if (prodErr) throw prodErr;
  product.id = prods!.id;

  // 4. Inject opening "available" stock so the cashier has something to
  //    sell. In real life this happens through goods receipts; e2e
  //    short-circuits via the service role.
  const { error: stockErr } = await admin.from("stock_balances").upsert(
    {
      tenant_id: tenantId,
      branch_id: branchId,
      product_id: product.id,
      state: "available",
      quantity: 100,
    },
    { onConflict: "tenant_id,branch_id,product_id,variant_id,state" },
  );
  if (stockErr) throw stockErr;

  return { email, password, tenantId, branchId, userId, product };
}

async function teardown(seeded: { tenantId: string; userId: string }): Promise<void> {
  // Cascade delete tenant rows then delete the auth user.
  await admin.from("tenants").delete().eq("id", seeded.tenantId);
  await admin.auth.admin.deleteUser(seeded.userId);
}

export const test = base.extend<{ pos: PosFixture }>({
  pos: async ({}, use) => {
    const seeded = await bootstrap();
    const fixture: PosFixture = {
      email: seeded.email,
      password: seeded.password,
      tenantId: seeded.tenantId,
      branchId: seeded.branchId,
      userId: seeded.userId,
      product: seeded.product,
      signIn: async (page: Page) => {
        await page.goto("/login");
        await page.getByLabel("Email").fill(seeded.email);
        await page.getByLabel("Password").fill(seeded.password);
        await page.getByRole("button", { name: "Sign in" }).click();
        // Server action redirects to /dashboard on success.
        await page.waitForURL(/\/dashboard($|\?|\/)/, { timeout: 20_000 });
      },
    };
    await use(fixture);
    await teardown(seeded);
  },
});

export { expect };
