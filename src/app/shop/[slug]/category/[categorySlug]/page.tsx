import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/storefront/product-grid";
import {
  getStorefrontShop,
  listStorefrontCategories,
  listStorefrontProducts,
} from "@/lib/storefront/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; categorySlug: string }>;
}): Promise<Metadata> {
  const { slug, categorySlug } = await params;
  const shop = await getStorefrontShop(slug);
  const cats = shop ? await listStorefrontCategories(shop) : [];
  const cat = cats.find((c) => c.slug === categorySlug);
  return { title: cat ? `${cat.name} — ${shop?.publicSiteName}` : "Category" };
}

export default async function ShopCategoryPage({
  params,
}: {
  params: Promise<{ slug: string; categorySlug: string }>;
}) {
  const { slug, categorySlug } = await params;
  const shop = await getStorefrontShop(slug);
  if (!shop) notFound();

  const categories = await listStorefrontCategories(shop);
  const active = categories.find((c) => c.slug === categorySlug);
  if (!active) notFound();

  const products = await listStorefrontProducts(shop, {
    categorySlug,
    limit: 200,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-50">{active.name}</h1>
        <p className="text-muted-foreground text-sm">
          {active.productCount} products · tap + to add to your cart
        </p>
      </div>

      <ProductGrid shopSlug={shop.slug} products={products} />
    </div>
  );
}
