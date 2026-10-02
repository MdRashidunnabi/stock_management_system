import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/storefront/product-grid";
import {
  getStorefrontShop,
  listStorefrontBrands,
  listStorefrontProducts,
} from "@/lib/storefront/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; brandSlug: string }>;
}): Promise<Metadata> {
  const { slug, brandSlug } = await params;
  const shop = await getStorefrontShop(slug);
  const brands = shop ? await listStorefrontBrands(shop) : [];
  const brand = brands.find((b) => b.slug === brandSlug);
  return { title: brand ? `${brand.name} — ${shop?.publicSiteName}` : "Brand" };
}

export default async function ShopBrandPage({
  params,
}: {
  params: Promise<{ slug: string; brandSlug: string }>;
}) {
  const { slug, brandSlug } = await params;
  const shop = await getStorefrontShop(slug);
  if (!shop) notFound();

  const brands = await listStorefrontBrands(shop);
  const active = brands.find((b) => b.slug === brandSlug);
  if (!active) notFound();

  const products = await listStorefrontProducts(shop, {
    brandSlug,
    limit: 200,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{active.name}</h1>
        <p className="text-muted-foreground text-sm">
          {active.productCount} products · tap + to add to your cart
        </p>
      </div>

      <ProductGrid shopSlug={shop.slug} products={products} />
    </div>
  );
}
