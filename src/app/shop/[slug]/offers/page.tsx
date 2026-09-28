import type { Metadata } from "next";
import { ProductGrid } from "@/components/storefront/product-grid";
import { getStorefrontShop, listStorefrontProducts } from "@/lib/storefront/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getStorefrontShop(slug);
  return { title: `Offers — ${shop?.publicSiteName ?? "Shop"}` };
}

export default async function ShopOffersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getStorefrontShop(slug);
  if (!shop) return null;

  const products = await listStorefrontProducts(shop, { discountedOnly: true, limit: 120 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Discounted products</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Only items with an online discount. In-store prices may differ.
        </p>
      </div>
      {products.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          No discounted products at the moment. Check back soon.
        </p>
      ) : (
        <ProductGrid shopSlug={shop.slug} products={products} />
      )}
    </div>
  );
}
