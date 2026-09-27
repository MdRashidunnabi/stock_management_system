"use server";

import { revalidatePath } from "next/cache";
import { parse } from "csv-parse/sync";
import { createClient } from "@/lib/supabase/server";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { productBaseSchema } from "@/lib/catalog/products/schemas";
import {
  commitImportSchema,
  parseCsvSchema,
  type ParsedProductRow,
} from "@/lib/catalog/products-import/schemas";
import { slugify } from "@/lib/utils";

const writableRoles = ["owner", "manager", "warehouse"] as const;

/**
 * Bulk product import.
 *
 * Two-step UX:
 *
 *   1. parseProductsCsvAction(csvText)
 *      Server parses + validates. Returns annotated rows.
 *      Lookups for category/brand/supplier are resolved here so the user can
 *      see meaningful errors before committing.
 *
 *   2. commitProductsImportAction(rows)
 *      Server inserts the valid rows in a single batch.
 *
 * Expected CSV columns (header row required, order-insensitive, case-insensitive):
 *   name             - required
 *   sku              - optional, unique per tenant
 *   barcode          - optional, unique per tenant
 *   category         - optional; matched by name/slug, created if missing
 *   brand            - optional; matched by name/slug, created if missing
 *   supplier         - optional; matched by name/code, created if missing
 *   purchase_price   - optional, defaults 0
 *   selling_price    - optional, defaults 0
 *   vat_code         - optional, one of STD|RED|SEC|LIV|ZER|EXE, default STD
 *   vat_included     - optional, true|false|1|0|yes|no, default true
 *   base_unit        - optional, default "un"
 *   is_active        - optional, true|false|1|0|yes|no, default true
 *   image_url        - optional HTTPS URL or site path. Local folders
 *                      (e.g. product_images/SKU.jpg) are skipped.
 */
export const parseProductsCsvAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "products.import.parse" })
  .inputSchema(parseCsvSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();

    let records: Record<string, string>[];
    try {
      records = parse(parsedInput.csvText, {
        columns: (header: string[]) =>
          header.map((h) => h.toLowerCase().trim().replace(/\s+/g, "_")),
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not parse CSV";
      throw new ActionError(`CSV parse error: ${message}`);
    }

    if (records.length === 0) {
      throw new ActionError("CSV did not contain any data rows.");
    }

    if (records.length > 1000) {
      throw new ActionError("Too many rows. Split into batches of 1000.");
    }

    /* ----- Pre-fetch lookup tables for the active tenant (RLS scoped) ---- */

    const [cats, brs, sups] = await Promise.all([
      supabase.from("categories").select("id, slug, name, is_active").eq("is_active", true),
      supabase.from("brands").select("id, slug, name, is_active").eq("is_active", true),
      supabase.from("suppliers").select("id, code, name, is_active").eq("is_active", true),
    ]);
    if (cats.error) throw new ActionError(`Could not load categories: ${cats.error.message}`);
    if (brs.error) throw new ActionError(`Could not load brands: ${brs.error.message}`);
    if (sups.error) throw new ActionError(`Could not load suppliers: ${sups.error.message}`);

    const categoryByKey = new Map<string, { id: string; name: string }>();
    for (const c of cats.data ?? []) {
      if (c.slug) categoryByKey.set(c.slug.toLowerCase(), { id: c.id, name: c.name });
      if (c.name) categoryByKey.set(c.name.toLowerCase(), { id: c.id, name: c.name });
    }
    const brandByKey = new Map<string, { id: string; name: string }>();
    for (const b of brs.data ?? []) {
      if (b.slug) brandByKey.set(b.slug.toLowerCase(), { id: b.id, name: b.name });
      if (b.name) brandByKey.set(b.name.toLowerCase(), { id: b.id, name: b.name });
    }
    const supplierByKey = new Map<string, { id: string; name: string }>();
    for (const s of sups.data ?? []) {
      if (s.code) supplierByKey.set(s.code.toLowerCase(), { id: s.id, name: s.name });
      if (s.name) supplierByKey.set(s.name.toLowerCase(), { id: s.id, name: s.name });
    }

    await ensureImportLookups(supabase, ctx.tenant.tenantId, records, {
      categoryByKey,
      brandByKey,
      supplierByKey,
    });

    /* ---------- Pre-fetch existing SKUs / barcodes for dedup ---------- */

    const allSkus = records
      .map((r) => normalizeSkuOrBarcode(r.sku ?? "").toUpperCase())
      .filter((v) => v.length > 0);
    const allBarcodes = records.map((r) => (r.barcode ?? "").trim()).filter((v) => v.length > 0);

    const existingSkus = new Set<string>();
    if (allSkus.length > 0) {
      const { data: skuRows, error: skuErr } = await supabase
        .from("products")
        .select("sku")
        .in("sku", allSkus);
      if (skuErr) throw new ActionError(skuErr.message);
      for (const r of skuRows ?? []) if (r.sku) existingSkus.add(r.sku.toUpperCase());
    }

    const existingBarcodes = new Set<string>();
    if (allBarcodes.length > 0) {
      const { data: bcRows, error: bcErr } = await supabase
        .from("products")
        .select("barcode")
        .in("barcode", allBarcodes);
      if (bcErr) throw new ActionError(bcErr.message);
      for (const r of bcRows ?? []) if (r.barcode) existingBarcodes.add(r.barcode);
    }

    const seenSkus = new Set<string>();
    const seenBarcodes = new Set<string>();

    /* ----------------------- Validate row by row ----------------------- */

    const out: ParsedProductRow[] = [];
    for (let i = 0; i < records.length; i += 1) {
      const raw = records[i] ?? {};
      const rowNumber = i + 2;

      const candidate = {
        name: raw.name ?? "",
        sku: raw.sku ?? "",
        barcode: raw.barcode ?? "",
        categoryId: lookupId(categoryByKey, raw.category) ?? "",
        brandId: lookupId(brandByKey, raw.brand) ?? "",
        defaultSupplierId: lookupId(supplierByKey, raw.supplier) ?? "",
        purchasePrice: parseNumber(raw.purchase_price, 0),
        sellingPrice: parseNumber(raw.selling_price, 0),
        vatCode: parseVatCode(raw.vat_code),
        vatIncluded: parseBoolean(raw.vat_included, true),
        baseUnit: (raw.base_unit ?? "un").trim() || "un",
        isActive: parseBoolean(raw.is_active, true),
        primaryImageUrl: normalizeImportImageUrl(
          raw.image_url ?? raw.primary_image_url ?? "",
        ),
        onlineSellingPrice: undefined,
        onlineDiscountPct: 0,
      };

      const errors: string[] = [];

      if (raw.category?.trim() && !candidate.categoryId) {
        errors.push(`Could not create category "${raw.category.trim()}"`);
      }
      if (raw.brand?.trim() && !candidate.brandId) {
        errors.push(`Could not create brand "${raw.brand.trim()}"`);
      }
      if (raw.supplier?.trim() && !candidate.defaultSupplierId) {
        errors.push(`Could not create supplier "${raw.supplier.trim()}"`);
      }

      const parsed = productBaseSchema.safeParse(candidate);
      if (!parsed.success) {
        errors.push(...parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
      }

      if (parsed.success && parsed.data.sku) {
        const upper = parsed.data.sku;
        if (existingSkus.has(upper)) errors.push(`SKU "${upper}" already exists in your catalog`);
        else if (seenSkus.has(upper)) errors.push(`SKU "${upper}" is duplicated within this CSV`);
        else seenSkus.add(upper);
      }
      if (parsed.success && parsed.data.barcode) {
        const bc = parsed.data.barcode;
        if (existingBarcodes.has(bc)) errors.push(`Barcode "${bc}" already exists in your catalog`);
        else if (seenBarcodes.has(bc)) errors.push(`Barcode "${bc}" is duplicated within this CSV`);
        else seenBarcodes.add(bc);
      }

      if (errors.length > 0 || !parsed.success) {
        out.push({ rowNumber, raw, ok: false, error: errors.join("; ") });
        continue;
      }

      out.push({
        rowNumber,
        raw,
        ok: true,
        payload: {
          ...parsed.data,
          _category: candidate.categoryId
            ? (categoryByKey.get((raw.category ?? "").trim().toLowerCase()) ?? null)
            : null,
          _brand: candidate.brandId
            ? (brandByKey.get((raw.brand ?? "").trim().toLowerCase()) ?? null)
            : null,
          _supplier: candidate.defaultSupplierId
            ? (supplierByKey.get((raw.supplier ?? "").trim().toLowerCase()) ?? null)
            : null,
        },
      });
    }

    return {
      ok: true as const,
      tenantId: ctx.tenant.tenantId,
      rows: out,
      summary: {
        total: out.length,
        valid: out.filter((r) => r.ok).length,
        errors: out.filter((r) => !r.ok).length,
      },
    };
  });

export const commitProductsImportAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "products.import.commit" })
  .inputSchema(commitImportSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const rows = parsedInput.rows.map((r) => ({
      ...r,
      tenant_id: ctx.tenant.tenantId,
      sku: r.sku || null,
      barcode: r.barcode || null,
      category_id: r.category_id || null,
      brand_id: r.brand_id || null,
      default_supplier_id: r.default_supplier_id || null,
      primary_image_url: normalizeImportImageUrl(r.primary_image_url ?? "") ?? null,
    }));

    const { data, error } = await supabase.from("products").insert(rows).select("id");

    if (error) {
      throw new ActionError(`Import failed: ${error.message}`);
    }

    revalidatePath("/products");
    revalidatePath("/categories");
    revalidatePath("/brands");
    revalidatePath("/suppliers");
    return { ok: true as const, inserted: data?.length ?? 0 };
  });

/* ------------------------------ Helpers ------------------------------ */

function normalizeSkuOrBarcode(v: string): string {
  return v.replace(/\s+/g, "").trim();
}

function lookupId(
  index: Map<string, { id: string; name: string }>,
  raw: string | undefined,
): string | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase();
  if (!key) return undefined;
  return index.get(key)?.id;
}

function parseNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === null) return fallback;
  const trimmed = String(raw).trim();
  if (trimmed === "") return fallback;
  const cleaned = trimmed.replace(/[€,$£\s]/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  const v = String(raw).trim().toLowerCase();
  if (v === "") return fallback;
  if (["true", "1", "yes", "y", "t"].includes(v)) return true;
  if (["false", "0", "no", "n", "f"].includes(v)) return false;
  return fallback;
}

function parseVatCode(raw: string | undefined): "STD" | "RED" | "SEC" | "LIV" | "ZER" | "EXE" {
  if (!raw) return "STD";
  const v = raw.trim().toUpperCase();
  if (["STD", "RED", "SEC", "LIV", "ZER", "EXE"].includes(v)) {
    return v as "STD" | "RED" | "SEC" | "LIV" | "ZER" | "EXE";
  }
  return "STD";
}

type LookupMap = Map<string, { id: string; name: string }>;
type DbClient = Awaited<ReturnType<typeof createClient>>;

function normalizeImportImageUrl(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  if (/^https?:\/\//i.test(t) || t.startsWith("/")) return t;
  return undefined;
}

function uniqueFieldValues(records: Record<string, string>[], field: string): string[] {
  const seen = new Set<string>();
  for (const row of records) {
    const value = (row[field] ?? "").trim();
    if (value) seen.add(value);
  }
  return [...seen];
}

function rememberLookup(map: LookupMap, id: string, name: string, extra?: string | null) {
  map.set(name.toLowerCase(), { id, name });
  if (extra?.trim()) map.set(extra.trim().toLowerCase(), { id, name });
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

function lookupCreateError(kind: string, error: { message: string; code?: string }): string {
  if (error.code === "42501" || /row-level security/i.test(error.message)) {
    return "Sign in as owner or manager so missing categories and brands can be created during import.";
  }
  return `Could not create ${kind}: ${error.message}`;
}

async function ensureImportLookups(
  supabase: DbClient,
  tenantId: string,
  records: Record<string, string>[],
  maps: { categoryByKey: LookupMap; brandByKey: LookupMap; supplierByKey: LookupMap },
) {
  const missingCategories = uniqueFieldValues(records, "category").filter(
    (name) => !lookupId(maps.categoryByKey, name),
  );
  if (missingCategories.length > 0) {
    const { data: slugRows, error: slugErr } = await supabase.from("categories").select("slug");
    if (slugErr) throw new ActionError(slugErr.message);
    const used = new Set((slugRows ?? []).map((r) => r.slug.toLowerCase()));
    const insertRows = missingCategories.map((name, index) => ({
      tenant_id: tenantId,
      name,
      slug: nextSlug(name, used),
      position: index,
    }));
    const { data, error } = await supabase
      .from("categories")
      .insert(insertRows)
      .select("id, name, slug");
    if (error) throw new ActionError(lookupCreateError("categories", error));
    for (const row of data ?? []) rememberLookup(maps.categoryByKey, row.id, row.name, row.slug);
  }

  const missingBrands = uniqueFieldValues(records, "brand").filter(
    (name) => !lookupId(maps.brandByKey, name),
  );
  if (missingBrands.length > 0) {
    const { data: slugRows, error: slugErr } = await supabase.from("brands").select("slug");
    if (slugErr) throw new ActionError(slugErr.message);
    const used = new Set((slugRows ?? []).map((r) => r.slug.toLowerCase()));
    const insertRows = missingBrands.map((name) => ({
      tenant_id: tenantId,
      name,
      slug: nextSlug(name, used),
    }));
    const { data, error } = await supabase.from("brands").insert(insertRows).select("id, name, slug");
    if (error) throw new ActionError(lookupCreateError("brands", error));
    for (const row of data ?? []) rememberLookup(maps.brandByKey, row.id, row.name, row.slug);
  }

  const missingSuppliers = uniqueFieldValues(records, "supplier").filter(
    (name) => !lookupId(maps.supplierByKey, name),
  );
  if (missingSuppliers.length > 0) {
    const insertRows = missingSuppliers.map((name) => ({
      tenant_id: tenantId,
      name,
    }));
    const { data, error } = await supabase
      .from("suppliers")
      .insert(insertRows)
      .select("id, name, code");
    if (error) throw new ActionError(lookupCreateError("suppliers", error));
    for (const row of data ?? []) rememberLookup(maps.supplierByKey, row.id, row.name, row.code);
  }
}
