import type { Metadata } from "next";
import { ProductGrid } from "@/components/storefront/product-grid";
import { ShopHero } from "@/components/storefront/shop-hero";
import { ShopHomeShortcuts } from "@/components/storefront/shop-home-shortcuts";
import {
  getStorefrontShop,
  listStorefrontBrowseNav,
  listStorefrontProducts,
} from "@/lib/storefront/queries";

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

  const [products, offers, browse] = await Promise.all([
    listStorefrontProducts(shop, { limit: 48 }),
    listStorefrontProducts(shop, { discountedOnly: true, limit: 8 }),
    listStorefrontBrowseNav(shop),
  ]);
  const groupWord = browse.label.toLowerCase().replace(/s$/, "");

  return (
    <div className="space-y-10">
      <ShopHero shop={shop} />
      <ShopHomeShortcuts shopSlug={shop.slug} />

      {offers.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">On offer</h2>
            <p className="text-muted-foreground text-sm">
              Discounted products only — tap through for the full list.
            </p>
          </div>
          <ProductGrid shopSlug={shop.slug} products={offers} />
        </section>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Popular products</h2>
          <p className="text-muted-foreground text-sm">
            Choose a {groupWord}, then use + / − on each product.
          </p>
        </div>
        <ProductGrid shopSlug={shop.slug} products={products} />
        {products.length >= 48 ? (
          <p className="text-muted-foreground text-center text-xs">
            Showing first 48 products. Pick a {groupWord} to see more.
          </p>
        ) : null}
      </section>
    </div>
  );
}
