/**
 * Seeds "Needscarlow" demo shop from Shops/Needscarlow/needscarlow_images.
 *
 * Run: npm run db:seed:needscarlow
 *
 * Creates tenant, one branch, POS terminal, categories, ~1260 products with
 * images, opening stock, and demo users:
 *   owner@needscarlow.shopos.local
 *   manager@needscarlow.shopos.local
 *   cashier@needscarlow.shopos.local
 *   accountant@needscarlow.shopos.local
 * Password for all: DemoPass123!
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { POS_MISC_SKU } from "@/lib/pos/misc-product";
import { ensureNeedscarlowMiscProduct } from "./needscarlow-misc-product";

const TENANT_ID = "00000000-0000-0000-0000-000000000002";
const BRANCH_ID = "00000000-0000-0000-0000-000000000011";
const TERMINAL_ID = "00000000-0000-0000-0000-000000000021";
const SUPPLIER_ID = "00000000-0000-0000-0000-000000000201";

const IMAGES_SRC = path.join(process.cwd(), "Shops", "Needscarlow", "needscarlow_images");
const PUBLIC_LINK = path.join(process.cwd(), "public", "shops", "needscarlow");

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

const PASSWORD = "DemoPass123!";
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

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

function ensurePublicSymlink() {
  fs.mkdirSync(path.dirname(PUBLIC_LINK), { recursive: true });
  if (fs.existsSync(PUBLIC_LINK)) {
    const stat = fs.lstatSync(PUBLIC_LINK);
    if (stat.isSymbolicLink() || stat.isDirectory()) return;
    fs.rmSync(PUBLIC_LINK, { force: true });
  }
  const rel = path.relative(path.dirname(PUBLIC_LINK), IMAGES_SRC);
  fs.symlinkSync(rel, PUBLIC_LINK);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;
  if (!url || !serviceRole || !dbUrl) throw new Error("Missing Supabase env in .env.local");

  if (!fs.existsSync(IMAGES_SRC)) {
    throw new Error(`Images folder not found: ${IMAGES_SRC}`);
  }

  ensurePublicSymlink();
  console.info("[needscarlow] public image path:", PUBLIC_LINK);

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const sql = postgres(dbUrl, { onnotice: () => {} });

  const categories = fs
    .readdirSync(IMAGES_SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory());
  const products: Array<{
    sku: string;
    name: string;
    imageUrl: string;
    barcode: string;
    catSlug: string;
    catFolder: string;
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
      products.push({
        ...parsed,
        catSlug,
        catFolder: folder,
      });
    }
  }

  products.sort((a, b) => a.sku.localeCompare(b.sku));
  console.info(`[needscarlow] ${products.length} products from ${categories.length} categories`);

  try {
    await sql`
      insert into public.tenants (id, slug, legal_name, display_name, vat_number, country, status, trial_ends_at)
      values (${TENANT_ID}, 'needscarlow', 'Needscarlow Ltd', 'Needscarlow', 'IE9876543T', 'IE', 'trial', now() + interval '30 days')
      on conflict (id) do update set display_name = excluded.display_name
    `;

    await sql`
      insert into public.branches (id, tenant_id, code, name, address_line1, city, county, eircode)
      values (${BRANCH_ID}, ${TENANT_ID}, 'NCAR', 'Needscarlow - Carlow', 'Main Street', 'Carlow', 'Carlow', 'R93 XY12')
      on conflict (id) do nothing
    `;

    await sql`
      insert into public.pos_terminals (id, tenant_id, branch_id, code, name)
      values (${TERMINAL_ID}, ${TENANT_ID}, ${BRANCH_ID}, 'T1', 'Front till')
      on conflict (id) do nothing
    `;

    await sql`
      insert into public.suppliers (id, tenant_id, code, name, country, payment_terms)
      values (${SUPPLIER_ID}, ${TENANT_ID}, 'NC-WHL', 'Needscarlow Wholesale', 'IE', 'Net 30')
      on conflict (id) do nothing
    `;

    await sql`delete from public.stock_balances where tenant_id = ${TENANT_ID}`;
    await sql`delete from public.products where tenant_id = ${TENANT_ID}`;

    let pos = 0;
    for (const catDir of categories) {
      const folder = catDir.name;
      const slug = categorySlug(folder);
      const name = categoryLabel(folder);
      pos += 1;
      await sql`
        insert into public.categories (tenant_id, name, slug, position)
        values (${TENANT_ID}, ${name}, ${slug}, ${pos})
        on conflict (tenant_id, slug) do update set name = excluded.name, position = excluded.position
      `;
    }

    const BATCH = 80;
    for (let i = 0; i < products.length; i += BATCH) {
      const batch = products.slice(i, i + BATCH);
      for (const p of batch) {
        await sql`
          insert into public.products (
            tenant_id, name, sku, barcode, category_id, default_supplier_id,
            purchase_price, selling_price, vat_code, vat_included, base_unit,
            primary_image_url, is_active
          )
          select
            ${TENANT_ID},
            ${p.name},
            ${p.sku},
            ${p.barcode},
            (select id from public.categories where tenant_id = ${TENANT_ID} and slug = ${p.catSlug} limit 1),
            ${SUPPLIER_ID},
            0.99,
            2.49,
            'STD'::public.vat_code,
            true,
            'un',
            ${p.imageUrl},
            true
          on conflict (tenant_id, sku) do update set
            name = excluded.name,
            barcode = excluded.barcode,
            category_id = excluded.category_id,
            primary_image_url = excluded.primary_image_url,
            is_active = true,
            archived_at = null
        `;
      }
      console.info(
        `[needscarlow] products ${Math.min(i + BATCH, products.length)} / ${products.length}`,
      );
    }

    await ensureNeedscarlowMiscProduct(sql);
    console.info("[needscarlow] miscellaneous POS product NC-MISC-0001 (search MISC on till)");

    await sql`
      insert into public.stock_balances (tenant_id, branch_id, product_id, state, quantity)
      select ${TENANT_ID}, ${BRANCH_ID}, id, 'available', 30
      from public.products where tenant_id = ${TENANT_ID} and sku <> ${POS_MISC_SKU}
      on conflict (tenant_id, branch_id, product_id, variant_id, state) do update
        set quantity = excluded.quantity
    `;

    for (const u of DEMO_USERS) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 500,
      });
      if (listErr) throw listErr;

      let userId = list.users.find((row) => row.email === u.email)?.id;
      if (userId) {
        const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: u.fullName },
        });
        if (updErr) throw updErr;
      } else {
        const { data, error: createErr } = await admin.auth.admin.createUser({
          email: u.email,
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: u.fullName },
        });
        if (createErr) throw createErr;
        userId = data.user.id;
      }
      if (u.role === "cashier") {
        await sql`
          insert into public.user_tenants (user_id, tenant_id, role, branch_id, is_active, accepted_at)
          values (${userId}, ${TENANT_ID}, ${u.role}, ${BRANCH_ID}, true, now())
          on conflict do nothing
        `;
      } else {
        await sql`
          insert into public.user_tenants (user_id, tenant_id, role, is_active, accepted_at)
          values (${userId}, ${TENANT_ID}, ${u.role}, true, now())
          on conflict do nothing
        `;
      }
      console.info(`[needscarlow] user ${u.email} (${u.role})`);
    }
  } finally {
    await sql.end({ timeout: 10 });
  }

  console.info("\n[needscarlow] done. Sign in at http://localhost:3000/login");
  console.info("  Shop: Needscarlow (switch tenant if you belong to multiple)");
  for (const u of DEMO_USERS) {
    console.info(`  ${u.email}  /  ${PASSWORD}`);
  }
}

main().catch((e) => {
  console.error("[needscarlow] failed:", e);
  process.exit(1);
});
