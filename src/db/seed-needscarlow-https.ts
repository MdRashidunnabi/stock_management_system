/**
 * Needscarlow seed over HTTPS (Supabase REST + Auth Admin).
 * Use when this PC cannot open Postgres ports 5432/6543.
 *
 *   npx tsx --env-file=.env.cloud.local src/db/seed-needscarlow-https.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { POS_MISC_SKU } from "@/lib/pos/misc-product";
import {
  MISC_PRODUCT,
  NEEDSCARLOW_BRANCH_ID,
  NEEDSCARLOW_SUPPLIER_ID,
  NEEDSCARLOW_TENANT_ID,
} from "./needscarlow-misc-product";

const TENANT_ID = NEEDSCARLOW_TENANT_ID;
const BRANCH_ID = NEEDSCARLOW_BRANCH_ID;
const TERMINAL_ID = "00000000-0000-0000-0000-000000000021";
const SUPPLIER_ID = NEEDSCARLOW_SUPPLIER_ID;
const IMAGES_SRC = path.join(process.cwd(), "Shops", "Needscarlow", "needscarlow_images");
const PASSWORD = "DemoPass123!";
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const DEMO_USERS = [
  {
    email: "owner@needscarlow.shopos.local",
    role: "owner",
    fullName: "Rashid Owner (Needscarlow)",
  },
  { email: "manager@needscarlow.shopos.local", role: "manager", fullName: "Needscarlow Manager" },
  { email: "cashier@needscarlow.shopos.local", role: "cashier", fullName: "Needscarlow Cashier" },
  {
    email: "accountant@needscarlow.shopos.local",
    role: "accountant",
    fullName: "Needscarlow Accountant",
  },
] as const;

function categorySlug(folder: string): string {
  return folder
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function categoryLabel(folder: string): string {
  return folder.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function categoryCode(folder: string): string {
  const slug = categorySlug(folder);
  const parts = slug.split("-").filter(Boolean);
  if (parts.length >= 2) return (parts[0]!.slice(0, 2) + parts[1]!.slice(0, 2)).toUpperCase();
  return slug.slice(0, 4).toUpperCase().padEnd(4, "X");
}

function parseImageFile(folder: string, filename: string, globalIndex: number) {
  const ext = path.extname(filename).toLowerCase();
  const base = path.basename(filename, ext);
  const m = base.match(/^(\d+)_(.+)$/);
  if (!m) return null;
  const seq = m[1]!;
  const code = categoryCode(folder);
  const sku = `NC-${code}-${seq.padStart(4, "0")}`;
  const name = m[2]!.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  const imageUrl =
    "/shops/needscarlow/" + [folder, filename].map((s) => encodeURIComponent(s)).join("/");
  const barcode = `5099${String(globalIndex).padStart(9, "0")}`;
  return { sku, name, imageUrl, barcode, seq: Number(seq) };
}

function throwIf(error: { message: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole)
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  if (!url.includes("supabase.co")) {
    throw new Error(`Refusing to seed: URL is not cloud Supabase (${url})`);
  }
  if (!fs.existsSync(IMAGES_SRC)) throw new Error(`Images folder not found: ${IMAGES_SRC}`);

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const categories = fs
    .readdirSync(IMAGES_SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory());
  const products: Array<{
    sku: string;
    name: string;
    imageUrl: string;
    barcode: string;
    catSlug: string;
  }> = [];
  let globalIndex = 0;
  for (const catDir of categories) {
    const folder = catDir.name;
    const catSlug = categorySlug(folder);
    const dir = path.join(IMAGES_SRC, folder);
    for (const file of fs.readdirSync(dir)) {
      const ext = path.extname(file).toLowerCase();
      if (!IMAGE_EXT.has(ext)) continue;
      globalIndex += 1;
      const parsed = parseImageFile(folder, file, globalIndex);
      if (!parsed) continue;
      products.push({ ...parsed, catSlug });
    }
  }
  products.sort((a, b) => a.sku.localeCompare(b.sku));
  console.info(`[needscarlow-https] ${products.length} products, ${categories.length} categories`);

  throwIf(
    (
      await admin.from("tenants").upsert({
        id: TENANT_ID,
        slug: "needscarlow",
        legal_name: "Needscarlow Ltd",
        display_name: "Needscarlow",
        vat_number: "IE9876543T",
        country: "IE",
        status: "trial",
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
    ).error,
    "tenants",
  );

  throwIf(
    (
      await admin.from("branches").upsert({
        id: BRANCH_ID,
        tenant_id: TENANT_ID,
        code: "NCAR",
        name: "Needscarlow - Carlow",
        address_line1: "Main Street",
        city: "Carlow",
        county: "Carlow",
        eircode: "R93 XY12",
      })
    ).error,
    "branches",
  );

  throwIf(
    (
      await admin.from("pos_terminals").upsert({
        id: TERMINAL_ID,
        tenant_id: TENANT_ID,
        branch_id: BRANCH_ID,
        code: "T1",
        name: "Front till",
      })
    ).error,
    "pos_terminals",
  );

  throwIf(
    (
      await admin.from("suppliers").upsert({
        id: SUPPLIER_ID,
        tenant_id: TENANT_ID,
        code: "NC-WHL",
        name: "Needscarlow Wholesale",
        country: "IE",
        payment_terms: "Net 30",
      })
    ).error,
    "suppliers",
  );

  throwIf(
    (
      await admin.from("tenant_billing").upsert({
        tenant_id: TENANT_ID,
        provider: "demo",
        plan_code: "standard",
        card_on_file: true,
        card_last4: "1881",
        card_brand: "visa",
      })
    ).error,
    "tenant_billing",
  );

  throwIf(
    (
      await admin.from("tenant_storefronts").upsert({
        tenant_id: TENANT_ID,
        branch_id: BRANCH_ID,
        enabled: true,
        hero_title: "Needscarlow",
        hero_subtitle: "Order online — stock stays in sync with our shop in Carlow",
        order_notice: "We will confirm your order by phone.",
        public_site_name: "Needscarlow",
      })
    ).error,
    "tenant_storefronts",
  );

  throwIf(
    (await admin.from("stock_balances").delete().eq("tenant_id", TENANT_ID)).error,
    "delete stock",
  );
  throwIf(
    (await admin.from("products").delete().eq("tenant_id", TENANT_ID)).error,
    "delete products",
  );

  let pos = 0;
  for (const catDir of categories) {
    pos += 1;
    throwIf(
      (
        await admin.from("categories").upsert(
          {
            tenant_id: TENANT_ID,
            name: categoryLabel(catDir.name),
            slug: categorySlug(catDir.name),
            position: pos,
          },
          { onConflict: "tenant_id,slug" },
        )
      ).error,
      `category ${catDir.name}`,
    );
  }

  const { data: catRows, error: catErr } = await admin
    .from("categories")
    .select("id, slug")
    .eq("tenant_id", TENANT_ID);
  throwIf(catErr, "load categories");
  const catId = new Map((catRows ?? []).map((r) => [r.slug as string, r.id as string]));

  const BATCH = 80;
  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH).map((p) => ({
      tenant_id: TENANT_ID,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      category_id: catId.get(p.catSlug) ?? null,
      default_supplier_id: SUPPLIER_ID,
      purchase_price: 0.99,
      selling_price: 2.49,
      vat_code: "STD",
      vat_included: true,
      base_unit: "un",
      primary_image_url: p.imageUrl,
      is_active: true,
    }));
    throwIf(
      (await admin.from("products").upsert(batch, { onConflict: "tenant_id,sku" })).error,
      `products ${i}`,
    );
    console.info(
      `[needscarlow-https] products ${Math.min(i + BATCH, products.length)} / ${products.length}`,
    );
  }

  throwIf(
    (
      await admin.from("categories").upsert(
        {
          tenant_id: TENANT_ID,
          name: "Miscellaneous",
          slug: "miscellaneous",
          position: 9999,
        },
        { onConflict: "tenant_id,slug" },
      )
    ).error,
    "misc category",
  );
  const { data: miscCat, error: miscCatErr } = await admin
    .from("categories")
    .select("id")
    .eq("tenant_id", TENANT_ID)
    .eq("slug", "miscellaneous")
    .maybeSingle();
  throwIf(miscCatErr, "misc category id");
  throwIf(
    (
      await admin.from("products").upsert(
        {
          tenant_id: TENANT_ID,
          name: MISC_PRODUCT.name,
          sku: MISC_PRODUCT.sku,
          barcode: MISC_PRODUCT.barcode,
          category_id: miscCat?.id ?? null,
          default_supplier_id: SUPPLIER_ID,
          purchase_price: MISC_PRODUCT.purchasePrice,
          selling_price: MISC_PRODUCT.sellingPrice,
          vat_code: "STD",
          vat_included: true,
          base_unit: "un",
          primary_image_url: null,
          is_active: true,
          allow_pos_custom_price: true,
        },
        { onConflict: "tenant_id,sku" },
      )
    ).error,
    "misc product",
  );

  const { data: productRows, error: prodErr } = await admin
    .from("products")
    .select("id, sku")
    .eq("tenant_id", TENANT_ID);
  throwIf(prodErr, "list products");
  const stockRows = (productRows ?? []).map((p) => ({
    tenant_id: TENANT_ID,
    branch_id: BRANCH_ID,
    product_id: p.id,
    state: "available",
    quantity: p.sku === POS_MISC_SKU ? MISC_PRODUCT.stockQty : 30,
  }));
  for (let i = 0; i < stockRows.length; i += BATCH) {
    throwIf(
      (await admin.from("stock_balances").insert(stockRows.slice(i, i + BATCH))).error,
      `stock ${i}`,
    );
  }

  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 500,
  });
  throwIf(listErr, "list users");

  for (const u of DEMO_USERS) {
    let userId = list.users.find((row) => row.email === u.email)?.id;
    if (userId) {
      throwIf(
        (
          await admin.auth.admin.updateUserById(userId, {
            password: PASSWORD,
            email_confirm: true,
            user_metadata: { full_name: u.fullName },
          })
        ).error,
        `update ${u.email}`,
      );
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.fullName },
      });
      throwIf(error, `create ${u.email}`);
      if (!data.user) throw new Error(`create ${u.email}: no user returned`);
      userId = data.user.id;
    }
    const membership = {
      user_id: userId,
      tenant_id: TENANT_ID,
      role: u.role,
      is_active: true,
      accepted_at: new Date().toISOString(),
      ...(u.role === "cashier" ? { branch_id: BRANCH_ID } : {}),
    };
    const { error: memErr } = await admin.from("user_tenants").insert(membership);
    if (memErr && !/duplicate|already exists|23505/i.test(memErr.message)) {
      throwIf(memErr, `membership ${u.email}`);
    }
    console.info(`[needscarlow-https] user ${u.email} (${u.role})`);
  }

  console.info("[needscarlow-https] done");
  console.info("  https://shopos-red.vercel.app/login");
  console.info("  https://shopos-red.vercel.app/shop/needscarlow");
}

main().catch((e) => {
  console.error("[needscarlow-https] failed:", e);
  process.exit(1);
});
