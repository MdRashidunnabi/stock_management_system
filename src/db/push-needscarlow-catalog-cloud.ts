/**
 * Replace cloud Needscarlow catalog with the local price list and pack photos.
 * Old products are deleted. Products without a local photo stay without a photo.
 *
 * Run: npx tsx src/db/push-needscarlow-catalog-cloud.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicProductImageUrl } from "@/lib/catalog/products/image-url";
import { slugify } from "@/lib/utils";
import {
  NEEDSCARLOW_BRANCH_ID,
  NEEDSCARLOW_SUPPLIER_ID,
  NEEDSCARLOW_TENANT_ID,
} from "./needscarlow-misc-product";

const TENANT = NEEDSCARLOW_TENANT_ID;
const WEBSITE_PUBLIC = path.join(process.cwd(), "needscarlow-web", "public");
const WEBSITE_CATALOG = path.join(process.cwd(), "needscarlow-web", "data", "products.json");
const IMAGE_DIRS = [path.join(WEBSITE_PUBLIC, "catalog"), path.join(WEBSITE_PUBLIC, "fresh")];
const CSV_FILE = path.join(
  process.cwd(),
  "Shops_Data",
  "Needs_Carlow",
  "shopos-upload",
  "needscarlow-catalog.csv",
);
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

type LocalProduct = {
  name: string;
  sku: string | null;
  barcode: string | null;
  category_name: string | null;
  brand_name: string | null;
  supplier_name: string | null;
  purchase_price: string;
  selling_price: string;
  vat_code: string;
  vat_included: boolean;
  base_unit: string;
  weighable: boolean;
  decimal_qty_allowed: boolean;
  primary_image_url: string | null;
  is_active: boolean;
  allow_pos_custom_price: boolean | null;
  online_discount_pct?: number;
};

function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function nextSlug(name: string, used: Set<string>): string {
  let stem = slugify(name) || "item";
  if (stem.length < 2) stem = `${stem}1`;
  let candidate = stem;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${stem}-${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

async function restDelete(supabase: SupabaseClient, table: string): Promise<void> {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .eq("tenant_id", TENANT);
  if (error) {
    console.info(`[cloud-catalog] ${table} delete: ${error.message}`);
    return;
  }
  console.info(`[cloud-catalog] deleted ${table} ${count ?? 0}`);
}

async function listProductIds(
  supabase: SupabaseClient,
): Promise<{ id: string; sku: string | null }[]> {
  const rows: { id: string; sku: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("products")
      .select("id, sku")
      .eq("tenant_id", TENANT)
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...(data as { id: string; sku: string | null }[]));
    if (data.length < 1000) break;
  }
  return rows;
}

function extraSupplierNames(products: LocalProduct[]): string[] {
  const names = new Set<string>();
  for (const p of products) {
    const name = p.supplier_name?.trim();
    if (!name) continue;
    if (name.toLowerCase() === "balkania int.food") continue;
    names.add(name);
  }
  return [...names];
}

function supplierFor(name: string | null, supplierId: Map<string, string>): string {
  const key = (name ?? "").trim().toLowerCase();
  return (key && supplierId.get(key)) || NEEDSCARLOW_SUPPLIER_ID;
}

function imageForProduct(product: LocalProduct, imageByKey: Map<string, string>): string | null {
  for (const raw of [product.barcode, product.sku, product.primary_image_url]) {
    const key = (raw ?? "").trim();
    if (!key) continue;
    const hit = imageByKey.get(key) ?? imageByKey.get(path.basename(key, path.extname(key)));
    if (hit) return hit;
    const digits = key.replace(/\D+/g, "");
    if (digits && imageByKey.get(digits)) return imageByKey.get(digits) ?? null;
    if (digits && imageByKey.get(digits.replace(/^0+/, "") || "0")) {
      return imageByKey.get(digits.replace(/^0+/, "") || "0") ?? null;
    }
  }
  return null;
}

function mimeFor(ext: string): string {
  const lower = ext.toLowerCase();
  if (lower === ".png") return "image/png";
  if (lower === ".webp") return "image/webp";
  if (lower === ".gif") return "image/gif";
  if (lower === ".avif") return "image/avif";
  return "image/jpeg";
}

function parseCsv(text: string): Record<string, string>[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (const line of lines.slice(1)) {
    const cols: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cols.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function loadWebsiteProducts(): LocalProduct[] {
  const data = JSON.parse(fs.readFileSync(WEBSITE_CATALOG, "utf8")) as {
    categories: { id: string; name: string }[];
    products: {
      name: string;
      sku: string;
      barcode: string;
      brand: string;
      categoryId: string;
      price: number;
      vat: string;
      unit: string;
      active: boolean;
      image?: string;
      valueDeal?: boolean;
      soldBy?: string;
    }[];
  };
  const categoryName = new Map(data.categories.map((c) => [c.id, c.name]));
  return data.products
    .filter((p) => p.name && p.active !== false)
    .map((p) => {
      const kg = p.soldBy === "kg" || p.unit === "kg";
      const price = Number(p.price) || 0;
      const deal = Boolean(p.valueDeal);
      const listPrice = deal ? Math.round((price / 0.9) * 100) / 100 : price;
      return {
        name: p.name,
        sku: p.sku || p.barcode || null,
        barcode: p.barcode || null,
        category_name: categoryName.get(p.categoryId) ?? "Grocery",
        brand_name: p.brand || null,
        supplier_name: "Balkania Int.food",
        purchase_price: (price * 0.7).toFixed(4),
        selling_price: listPrice.toFixed(4),
        vat_code: (p.vat || "ZER").toUpperCase(),
        vat_included: true,
        base_unit: kg ? "kg" : "un",
        weighable: kg,
        decimal_qty_allowed: kg,
        primary_image_url: p.image ?? null,
        is_active: true,
        allow_pos_custom_price: false,
        online_discount_pct: deal ? 10 : 0,
      };
    });
}

function loadCsvProducts(): LocalProduct[] {
  if (!fs.existsSync(CSV_FILE)) throw new Error(`Missing ${CSV_FILE}`);
  return parseCsv(fs.readFileSync(CSV_FILE, "utf8"))
    .map((r) => {
      const unit = (r.base_unit || "un").trim() || "un";
      const weighable = unit.toLowerCase() === "kg";
      return {
        name: r.name ?? "",
        sku: (r.sku || "").trim() || null,
        barcode: (r.barcode || "").trim() || null,
        category_name: (r.category || "").trim() || null,
        brand_name: (r.brand || "").trim() || null,
        supplier_name: (r.supplier || "").trim() || null,
        purchase_price: (r.purchase_price || "0").trim() || "0",
        selling_price: (r.selling_price || "0").trim() || "0",
        vat_code: (r.vat_code || "STD").trim().toUpperCase() || "STD",
        vat_included: !["false", "0", "no"].includes(
          (r.vat_included || "true").trim().toLowerCase(),
        ),
        base_unit: unit,
        weighable,
        decimal_qty_allowed: weighable,
        primary_image_url: (r.image_url || "").trim() || null,
        is_active: !["false", "0", "no"].includes((r.is_active || "true").trim().toLowerCase()),
        allow_pos_custom_price: false,
      };
    })
    .filter((p) => p.name);
}

async function uploadCatalogImages(supabase: SupabaseClient): Promise<Map<string, string>> {
  const imageByKey = new Map<string, string>();
  const files = IMAGE_DIRS.flatMap((dir) => {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((name) => IMAGE_EXTS.includes(path.extname(name).toLowerCase()))
      .map((name) => path.join(dir, name));
  });
  let uploaded = 0;
  for (const file of files) {
    const name = path.basename(file);
    const body = fs.readFileSync(file);
    if (body.length > 5 * 1024 * 1024) {
      console.info(`[cloud-catalog] skip oversized ${name}`);
      continue;
    }
    const storagePath = `${TENANT}/catalog/${name}`;
    const { error } = await supabase.storage.from("product-images").upload(storagePath, body, {
      upsert: true,
      contentType: mimeFor(path.extname(name)),
      cacheControl: "86400",
    });
    if (error) {
      console.info(`[cloud-catalog] upload failed ${name}: ${error.message}`);
      continue;
    }
    const url = publicProductImageUrl(storagePath);
    const stem = path.basename(name, path.extname(name));
    imageByKey.set(stem, url);
    imageByKey.set(name, url);
    const digits = stem.replace(/\D+/g, "");
    if (digits) {
      imageByKey.set(digits, url);
      imageByKey.set(digits.replace(/^0+/, "") || "0", url);
    }
    uploaded += 1;
    if (uploaded % 50 === 0 || uploaded === files.length) {
      console.info(`[cloud-catalog] uploaded photos ${uploaded}/${files.length}`);
    }
  }
  return imageByKey;
}

async function replaceViaHttps(
  supabase: SupabaseClient,
  products: LocalProduct[],
  imageByKey: Map<string, string>,
): Promise<void> {
  for (const table of [
    "online_order_items",
    "online_orders",
    "payments",
    "sale_items",
    "sales",
    "purchase_order_items",
    "goods_receipt_items",
    "purchase_orders",
    "goods_receipts",
    "stock_adjustments",
    "stock_balances",
    "product_variants",
    "product_branch_settings",
    "product_price_history",
    "batches",
    "stock_ledger",
  ]) {
    await restDelete(supabase, table);
  }

  const { data: ledgerRows, error: ledgerErr } = await supabase
    .from("stock_ledger")
    .select("product_id")
    .eq("tenant_id", TENANT);
  if (ledgerErr) throw ledgerErr;
  const pinned = new Set((ledgerRows ?? []).map((r) => r.product_id as string));

  const existing = await listProductIds(supabase);
  const removable = existing.filter((row) => !pinned.has(row.id));
  for (let i = 0; i < removable.length; i += 80) {
    const ids = removable.slice(i, i + 80).map((row) => row.id);
    const { error } = await supabase.from("products").delete().in("id", ids);
    if (error) throw error;
    console.info(
      `[cloud-catalog] deleted products ${Math.min(i + 80, removable.length)}/${removable.length}`,
    );
  }

  const leftover = await listProductIds(supabase);
  for (const row of leftover) {
    const token = row.id.replaceAll("-", "");
    const { error } = await supabase
      .from("products")
      .update({
        is_active: false,
        archived_at: new Date().toISOString(),
        online_visible: false,
        sku: `removed-${token}`,
        barcode: `ZZZ-${token}`,
        name: "Removed (old catalog)",
        primary_image_url: null,
        brand_id: null,
        category_id: null,
      })
      .eq("id", row.id)
      .eq("tenant_id", TENANT);
    if (error) throw error;
  }
  if (leftover.length) {
    console.info(`[cloud-catalog] pinned leftover products archived ${leftover.length}`);
  }

  await restDelete(supabase, "categories");
  await restDelete(supabase, "brands");

  const catUsed = new Set<string>();
  const brandUsed = new Set<string>();
  const categoryId = new Map<string, string>();
  const brandId = new Map<string, string>();
  const supplierId = new Map<string, string>([["balkania int.food", NEEDSCARLOW_SUPPLIER_ID]]);
  const categories = [
    ...new Set(products.map((p) => p.category_name?.trim()).filter(Boolean)),
  ] as string[];
  const brands = [
    ...new Set(products.map((p) => p.brand_name?.trim()).filter(Boolean)),
  ] as string[];

  for (const [index, name] of categories.entries()) {
    const slug = nextSlug(name, catUsed);
    const { data, error } = await supabase
      .from("categories")
      .insert({ tenant_id: TENANT, name, slug, position: index, is_active: true })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("category insert failed");
    categoryId.set(name.toLowerCase(), data.id);
  }
  for (const name of brands) {
    const slug = nextSlug(name, brandUsed);
    const { data, error } = await supabase
      .from("brands")
      .insert({ tenant_id: TENANT, name, slug, is_active: true })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("brand insert failed");
    brandId.set(name.toLowerCase(), data.id);
  }

  const { error: balkaniaErr } = await supabase
    .from("suppliers")
    .update({ name: "Balkania Int.food", is_active: true })
    .eq("id", NEEDSCARLOW_SUPPLIER_ID)
    .eq("tenant_id", TENANT);
  if (balkaniaErr) throw balkaniaErr;
  const { data: existingSuppliers, error: listSupErr } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("tenant_id", TENANT);
  if (listSupErr) throw listSupErr;
  for (const row of existingSuppliers ?? []) {
    if (row.name) supplierId.set(String(row.name).toLowerCase(), row.id as string);
  }
  for (const name of extraSupplierNames(products)) {
    const key = name.toLowerCase();
    if (supplierId.has(key)) continue;
    const { data, error } = await supabase
      .from("suppliers")
      .insert({ tenant_id: TENANT, name, is_active: true, country: "IE", default_currency: "EUR" })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("supplier insert failed");
    supplierId.set(key, data.id);
  }

  const { error: miscCatErr } = await supabase
    .from("categories")
    .upsert(
      {
        tenant_id: TENANT,
        name: "Miscellaneous",
        slug: "miscellaneous",
        position: 9999,
        is_active: true,
      },
      { onConflict: "tenant_id,slug" },
    );
  if (miscCatErr) throw miscCatErr;
  const { data: miscCat, error: miscCatIdErr } = await supabase
    .from("categories")
    .select("id")
    .eq("tenant_id", TENANT)
    .eq("slug", "miscellaneous")
    .maybeSingle();
  if (miscCatIdErr) throw miscCatIdErr;

  const rows = products.map((p) => {
    const barcode = p.barcode?.trim() || null;
    const sku = p.sku?.trim() || null;
    return {
      tenant_id: TENANT,
      name: p.name.slice(0, 200),
      sku,
      barcode,
      category_id: p.category_name ? (categoryId.get(p.category_name.toLowerCase()) ?? null) : null,
      brand_id: p.brand_name ? (brandId.get(p.brand_name.toLowerCase()) ?? null) : null,
      default_supplier_id: supplierFor(p.supplier_name, supplierId),
      purchase_price: p.purchase_price,
      selling_price: p.selling_price,
      vat_code: p.vat_code,
      vat_included: p.vat_included,
      base_unit: (p.base_unit || "un").slice(0, 8),
      weighable: p.weighable,
      decimal_qty_allowed: p.decimal_qty_allowed,
      primary_image_url: imageForProduct(p, imageByKey),
      is_active: p.is_active,
      archived_at: null,
      online_visible: true,
      online_selling_price: p.selling_price,
      online_discount_pct: p.online_discount_pct ?? 0,
      allow_pos_custom_price: p.allow_pos_custom_price ?? false,
    };
  });

  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase.from("products").insert(chunk);
    if (error) throw error;
    console.info(`[cloud-catalog] inserted ${Math.min(i + 50, rows.length)}/${rows.length}`);
  }

  const stockIds = (await listProductIds(supabase)).map((row) => row.id);
  for (let i = 0; i < stockIds.length; i += 80) {
    const chunk = stockIds.slice(i, i + 80).map((productId) => ({
      tenant_id: TENANT,
      branch_id: NEEDSCARLOW_BRANCH_ID,
      product_id: productId,
      state: "available" as const,
      quantity: 24,
    }));
    const { error } = await supabase.from("stock_balances").insert(chunk);
    if (error) console.info(`[cloud-catalog] stock: ${error.message}`);
  }
  console.info(`[cloud-catalog] stock rows ${stockIds.length}`);

  const { error: miscErr } = await supabase.from("products").upsert(
    {
      tenant_id: TENANT,
      name: "Miscellaneous sale",
      sku: "NC-MISC-0001",
      barcode: "5099009990001",
      category_id: miscCat?.id ?? null,
      default_supplier_id: NEEDSCARLOW_SUPPLIER_ID,
      purchase_price: 0,
      selling_price: 1,
      vat_code: "STD",
      vat_included: true,
      base_unit: "un",
      primary_image_url: null,
      is_active: true,
      archived_at: null,
      online_visible: false,
      allow_pos_custom_price: true,
    },
    { onConflict: "tenant_id,sku" },
  );
  if (miscErr) throw miscErr;

  const { count: total } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT)
    .eq("is_active", true)
    .is("archived_at", null);
  const { count: withImage } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT)
    .eq("is_active", true)
    .is("archived_at", null)
    .not("primary_image_url", "is", null)
    .neq("primary_image_url", "");
  const { count: brandsCount } = await supabase
    .from("brands")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT)
    .eq("is_active", true);
  const { count: archived } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT)
    .not("archived_at", "is", null);
  console.info(
    `[cloud-catalog] done products ${total} with_image ${withImage} brands ${brandsCount} archived_hidden ${archived ?? 0}`,
  );
}

async function main() {
  const cloudEnv = parseEnvFile(path.join(process.cwd(), ".env.cloud.local"));
  const supabaseUrl = cloudEnv.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = cloudEnv.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl.includes("emcegqocydcdztwiwivi")) {
    throw new Error("Refusing: cloud URL is not the ShopOS project");
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;

  const products = loadWebsiteProducts();
  if (products.length === 0) throw new Error("Website catalog was empty");
  console.info(`[cloud-catalog] website products ${products.length}`);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const imageByKey = await uploadCatalogImages(supabase);
  console.info(`[cloud-catalog] photos in catalog folder ${imageByKey.size} keys`);

  console.info("[cloud-catalog] replacing Needscarlow catalog over HTTPS");
  await replaceViaHttps(supabase, products, imageByKey);
}

main().catch((error) => {
  console.error("[cloud-catalog] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
