import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliverySettings } from "@/lib/storefront/delivery";
import { resolveStorefrontLogoUrl } from "@/lib/storefront/logo-url";
import { computeOnlinePriceDisplay } from "@/lib/storefront/pricing";
import { getStockDisplay, type StockDisplay } from "@/lib/storefront/stock-display";

export interface StorefrontShop {
  tenantId: string;
  slug: string;
  displayName: string;
  /** Public website title (falls back to tenant display name). */
  publicSiteName: string;
  /** Header logo URL (top-left on shop). */
  logoUrl: string | null;
  customDomain: string | null;
  branchId: string;
  tagline: string | null;
  phone: string | null;
  whatsapp: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  orderNotice: string | null;
  lowStockThreshold: number;
  delivery: DeliverySettings;
  enableTakeaway: boolean;
  enableOnlinePayment: boolean;
  onlinePriceMarkupPct: number;
  footerAbout: string | null;
  callUsLabel: string | null;
  facebookUrl: string | null;
  twitterUrl: string | null;
  youtubeUrl: string | null;
  instagramUrl: string | null;
  branches: StorefrontBranchOption[];
}

export interface StorefrontCategory {
  id: string;
  name: string;
  slug: string;
  position: number;
  productCount: number;
}

export interface StorefrontProduct {
  id: string;
  name: string;
  sku: string | null;
  /** In-store POS price (not shown on shop when online pricing is used). */
  sellingPrice: number;
  /** Customer-facing online price (after discount). */
  onlinePrice: number;
  compareAtPrice: number | null;
  discountPct: number | null;
  primaryImageUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  available: number;
  stock: StockDisplay;
}

const PRODUCT_SELECT = `
  id, name, sku, selling_price, online_selling_price, online_discount_pct, primary_image_url, category_id,
  categories ( id, name, slug )
`;

export interface StorefrontBranchOption {
  id: string;
  code: string;
  name: string;
}

export async function listStorefrontBranches(tenantId: string): Promise<StorefrontBranchOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("branches")
    .select("id, code, name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("is_warehouse", false)
    .order("name");
  return data ?? [];
}

export const getStorefrontShop = cache(
  async (slug: string, preferredBranchId?: string | null): Promise<StorefrontShop | null> => {
    const admin = createAdminClient();
    const normalized = slug.trim().toLowerCase();

    const { data: tenant, error } = await admin
      .from("tenants")
      .select("id, slug, display_name, status")
      .eq("slug", normalized)
      .in("status", ["trial", "active", "past_due"])
      .maybeSingle();

    if (error || !tenant) return null;

    const { data: storefront } = await admin
      .from("tenant_storefronts")
      .select(
        "enabled, branch_id, tagline, phone, whatsapp, hero_title, hero_subtitle, order_notice, low_stock_threshold, public_site_name, custom_domain, logo_url, delivery_standard_fee, delivery_free_over, delivery_min_order, enable_takeaway, enable_online_payment, footer_about, call_us_label, facebook_url, twitter_url, youtube_url, instagram_url, online_price_markup_pct",
      )
      .eq("tenant_id", tenant.id)
      .eq("enabled", true)
      .maybeSingle();

    if (!storefront) return null;

    const branches = await listStorefrontBranches(tenant.id);
    let branchId = preferredBranchId ?? storefront.branch_id;
    if (branchId && !branches.some((b) => b.id === branchId)) {
      branchId = null;
    }
    if (!branchId) {
      branchId = branches[0]?.id ?? null;
    }
    if (!branchId) {
      const { data: branch } = await admin
        .from("branches")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .eq("is_warehouse", false)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      branchId = branch?.id ?? null;
    }

    if (!branchId) return null;

    const publicSiteName = storefront.public_site_name?.trim() || tenant.display_name;

    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      displayName: tenant.display_name,
      publicSiteName,
      logoUrl: resolveStorefrontLogoUrl(storefront.logo_url),
      customDomain: storefront.custom_domain,
      branchId,
      tagline: storefront.tagline,
      phone: storefront.phone,
      whatsapp: storefront.whatsapp,
      heroTitle: storefront.hero_title,
      heroSubtitle: storefront.hero_subtitle,
      orderNotice: storefront.order_notice,
      lowStockThreshold: storefront.low_stock_threshold ?? 5,
      delivery: {
        standardFee: Number(storefront.delivery_standard_fee ?? 4.99),
        freeOver: Number(storefront.delivery_free_over ?? 50),
        minOrder: Number(storefront.delivery_min_order ?? 15),
      },
      enableTakeaway: storefront.enable_takeaway ?? true,
      enableOnlinePayment: storefront.enable_online_payment ?? true,
      onlinePriceMarkupPct: Number(storefront.online_price_markup_pct ?? 0.5),
      footerAbout: storefront.footer_about,
      callUsLabel: storefront.call_us_label,
      facebookUrl: storefront.facebook_url,
      twitterUrl: storefront.twitter_url,
      youtubeUrl: storefront.youtube_url,
      instagramUrl: storefront.instagram_url,
      branches,
    };
  },
);

export async function listStorefrontCategories(
  shop: StorefrontShop,
): Promise<StorefrontCategory[]> {
  const admin = createAdminClient();

  const { data: cats, error } = await admin
    .from("categories")
    .select("id, name, slug, position")
    .eq("tenant_id", shop.tenantId)
    .eq("is_active", true)
    .order("position", { ascending: true });

  if (error || !cats?.length) return [];

  const { data: products } = await admin
    .from("products")
    .select("category_id")
    .eq("tenant_id", shop.tenantId)
    .eq("is_active", true)
    .is("archived_at", null);

  const counts = new Map<string, number>();
  for (const p of products ?? []) {
    if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  }

  return cats
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      position: c.position ?? 0,
      productCount: counts.get(c.id) ?? 0,
    }))
    .filter((c) => c.productCount > 0);
}

async function attachStock(
  shop: StorefrontShop,
  rows: {
    id: string;
    name: string;
    sku: string | null;
    selling_price: number | string | null;
    online_selling_price: number | string | null;
    online_discount_pct: number | string | null;
    primary_image_url: string | null;
    category_id: string | null;
    categories:
      | { id: string; name: string; slug: string }
      | { id: string; name: string; slug: string }[]
      | null;
  }[],
): Promise<StorefrontProduct[]> {
  if (rows.length === 0) return [];

  const admin = createAdminClient();
  const ids = rows.map((r) => r.id);

  const { data: balances } = await admin
    .from("stock_balances")
    .select("product_id, quantity")
    .eq("tenant_id", shop.tenantId)
    .eq("branch_id", shop.branchId)
    .eq("state", "available")
    .in("product_id", ids);

  const byProduct = new Map<string, number>();
  for (const b of balances ?? []) {
    byProduct.set(b.product_id, Number(b.quantity ?? 0));
  }

  return rows.map((r) => {
    const cat = Array.isArray(r.categories) ? r.categories[0] : r.categories;
    const available = byProduct.get(r.id) ?? 0;
    const sellingPrice = Number(r.selling_price ?? 0);
    const online = computeOnlinePriceDisplay({
      sellingPrice,
      onlineSellingPrice:
        r.online_selling_price != null && Number(r.online_selling_price) > 0
          ? Number(r.online_selling_price)
          : null,
      onlineDiscountPct: r.online_discount_pct != null ? Number(r.online_discount_pct) : null,
      markupPct: shop.onlinePriceMarkupPct,
    });
    return {
      id: r.id,
      name: r.name,
      sku: r.sku,
      sellingPrice,
      onlinePrice: online.price,
      compareAtPrice: online.compareAtPrice,
      discountPct: online.discountPct,
      primaryImageUrl: r.primary_image_url,
      categoryId: r.category_id,
      categoryName: cat?.name ?? null,
      categorySlug: cat?.slug ?? null,
      available,
      stock: getStockDisplay(available, shop.lowStockThreshold),
    };
  });
}

export async function listStorefrontProducts(
  shop: StorefrontShop,
  opts?: { categorySlug?: string; search?: string; limit?: number },
): Promise<StorefrontProduct[]> {
  const admin = createAdminClient();
  const limit = opts?.limit ?? 48;

  let query = admin
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("tenant_id", shop.tenantId)
    .eq("is_active", true)
    .is("archived_at", null)
    .order("name", { ascending: true })
    .limit(limit);

  if (opts?.categorySlug) {
    const { data: cat } = await admin
      .from("categories")
      .select("id")
      .eq("tenant_id", shop.tenantId)
      .eq("slug", opts.categorySlug)
      .maybeSingle();
    if (!cat) return [];
    query = query.eq("category_id", cat.id);
  }

  if (opts?.search?.trim()) {
    const q = opts.search.trim();
    query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const admin2 = createAdminClient();
  const { data: branchSettings } = await admin2
    .from("product_branch_settings")
    .select("product_id, is_active")
    .eq("tenant_id", shop.tenantId)
    .eq("branch_id", shop.branchId);

  const inactive = new Set(
    (branchSettings ?? []).filter((s) => s.is_active === false).map((s) => s.product_id),
  );
  const hasSettings = (branchSettings?.length ?? 0) > 0;

  const filtered = hasSettings ? data.filter((p) => !inactive.has(p.id)) : data;

  return attachStock(shop, filtered);
}

export async function getStorefrontProduct(
  shop: StorefrontShop,
  productId: string,
): Promise<StorefrontProduct | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("tenant_id", shop.tenantId)
    .eq("id", productId)
    .eq("is_active", true)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !data) return null;

  const [product] = await attachStock(shop, [data]);
  return product ?? null;
}
