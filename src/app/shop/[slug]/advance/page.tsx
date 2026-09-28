import type { Metadata } from "next";
import { ProductGrid } from "@/components/storefront/product-grid";
import { AdvanceDatePicker } from "@/components/storefront/advance-date-picker";
import { getStorefrontShop, listStorefrontProducts } from "@/lib/storefront/queries";
import { MIN_ADVANCE_DAYS, minAdvanceDateYmd } from "@/lib/reports/period";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getStorefrontShop(slug);
  return { title: `Order ahead — ${shop?.publicSiteName ?? "Shop"}` };
}

export default async function ShopAdvancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getStorefrontShop(slug);
  if (!shop) return null;

  const products = await listStorefrontProducts(shop, { limit: 48 });
  const minDate = minAdvanceDateYmd();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Order ahead</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pick a date at least {MIN_ADVANCE_DAYS} days from today, add products, then checkout. We
          will prepare for delivery or collection on that day.
        </p>
      </div>
      <AdvanceDatePicker minDate={minDate} />
      <section className="space-y-4">
        <h2 className="text-lg font-bold">Add products</h2>
        <ProductGrid shopSlug={shop.slug} products={products} />
      </section>
    </div>
  );
}
