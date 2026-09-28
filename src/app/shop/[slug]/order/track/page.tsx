import type { Metadata } from "next";
import { OrderTrackForm } from "@/components/storefront/order-track-form";
import { getStorefrontShop } from "@/lib/storefront/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getStorefrontShop(slug);
  return { title: `Track order — ${shop?.publicSiteName ?? "Shop"}` };
}

export default async function ShopTrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const shop = await getStorefrontShop(slug);
  if (!shop) return null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Track your order</h1>
      <p className="text-muted-foreground text-sm">
        Enter the order number from your confirmation and the phone you used at checkout.
      </p>
      <OrderTrackForm shopSlug={shop.slug} initialOrder={sp.order} />
    </div>
  );
}
