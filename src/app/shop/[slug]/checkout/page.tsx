import { CheckoutForm } from "@/components/storefront/checkout-form";
import { getStorefrontShop } from "@/lib/storefront/queries";

export default async function ShopCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const shop = await getStorefrontShop(slug);
  if (!shop) return null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Checkout</h1>
      {sp.payment === "cancelled" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The card payment was cancelled. Your order is saved and still unpaid. You can pay by cash
          instead, or try the card again.
        </p>
      ) : null}
      <p className="text-muted-foreground text-sm">
        {shop.orderNotice ?? "We will contact you to confirm delivery."}
      </p>
      <CheckoutForm
        shopSlug={shop.slug}
        delivery={shop.delivery}
        deliveryAreas={shop.deliveryAreas}
        enableTakeaway={shop.enableTakeaway}
        enableOnlinePayment={shop.enableOnlinePayment}
      />
    </div>
  );
}
