import type { Metadata } from "next";
import { ProductGrid } from "@/components/storefront/product-grid";
import {
  getStorefrontShop,
  listStorefrontBrowseNav,
  listStorefrontProducts,
} from "@/lib/storefront/queries";

type SearchParams = Promise<{ q?: string; brand?: string; category?: string }>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const shop = await getStorefrontShop(slug);
  const q = sp.q?.trim();
  return {
    title: q
      ? `Search: ${q} — ${shop?.publicSiteName ?? "Shop"}`
      : `Search — ${shop?.publicSiteName ?? "Shop"}`,
  };
}

export default async function ShopSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const shop = await getStorefrontShop(slug);
  if (!shop) return null;

  const q = sp.q?.trim() ?? "";
  const brandSlug = sp.brand && sp.brand !== "all" ? sp.brand : undefined;
  const categorySlug = sp.category && sp.category !== "all" ? sp.category : undefined;

  const products = await listStorefrontProducts(shop, {
    search: q || undefined,
    brandSlug,
    categorySlug,
    limit: 120,
  });

  const browse = await listStorefrontBrowseNav(shop);
  const filterLabel = brandSlug
    ? browse.items.find((b) => b.slug === brandSlug)?.name
    : categorySlug
      ? browse.items.find((c) => c.slug === categorySlug)?.name
      : null;
  const groupWord = browse.label.toLowerCase().replace(/s$/, "");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search results</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {q ? (
            <>
              Showing results for{" "}
              <span className="text-foreground font-medium">&quot;{q}&quot;</span>
              {filterLabel ? <> in {filterLabel}</> : null}
            </>
          ) : filterLabel ? (
            <>Browsing {filterLabel}</>
          ) : (
            <>Enter a search term or pick a {groupWord} above</>
          )}
          {" · "}
          {products.length} product{products.length === 1 ? "" : "s"}
        </p>
      </div>

      {products.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          No products found. Try another keyword or {groupWord}.
        </p>
      ) : (
        <ProductGrid shopSlug={shop.slug} products={products} />
      )}
    </div>
  );
}
