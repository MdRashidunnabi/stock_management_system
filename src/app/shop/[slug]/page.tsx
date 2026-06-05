import type { Metadata } from "next";
import { ProductGrid } from "@/components/storefront/product-grid";
import { ShopHero } from "@/components/storefront/shop-hero";
import { getStorefrontShop, listStorefrontProducts } from "@/lib/storefront/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getStorefrontShop(slug);
  return {
    title: shop ? `${shop.publicSiteName} — Online shop` : "Shop",
    description: shop?.heroSubtitle ?? "Order groceries online",
  };
}

export default async function ShopHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getStorefrontShop(slug);
  if (!shop) return null;

  const products = await listStorefrontProducts(shop, { limit: 48 });

  return (
    <div className="space-y-10">
      <ShopHero shop={shop} />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 dark:text-stone-50">Popular products</h2>
          <p className="text-muted-foreground text-sm">
            Choose a category on the left, then use + / − on each product.
          </p>
        </div>
        <ProductGrid shopSlug={shop.slug} products={products} />
        {products.length >= 48 ? (
          <p className="text-muted-foreground text-center text-xs">
            Showing first 48 products. Pick a category to see more.
          </p>
        ) : null}
      </section>
    </div>
  );
}
