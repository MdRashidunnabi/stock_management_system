import type { Metadata } from "next";
import { ProductGrid } from "@/components/storefront/product-grid";
import {
  getStorefrontShop,
  listStorefrontCategories,
  listStorefrontProducts,
} from "@/lib/storefront/queries";

type SearchParams = Promise<{ q?: string; category?: string }>;

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
  const categorySlug = sp.category && sp.category !== "all" ? sp.category : undefined;

  const products = await listStorefrontProducts(shop, {
    search: q || undefined,
    categorySlug,
    limit: 120,
  });

  const catLabel = categorySlug
    ? (await listStorefrontCategories(shop)).find((c) => c.slug === categorySlug)?.name
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search results</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {q ? (
            <>
              Showing results for{" "}
              <span className="text-foreground font-medium">&quot;{q}&quot;</span>
              {catLabel ? <> in {catLabel}</> : null}
            </>
          ) : catLabel ? (
            <>Browsing {catLabel}</>
          ) : (
            <>Enter a search term or pick a category above</>
          )}
          {" · "}
          {products.length} product{products.length === 1 ? "" : "s"}
        </p>
      </div>

      {products.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          No products found. Try another keyword or category.
        </p>
      ) : (
        <ProductGrid shopSlug={shop.slug} products={products} />
      )}
    </div>
  );
}
