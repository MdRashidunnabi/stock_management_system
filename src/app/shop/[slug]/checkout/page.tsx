import { CheckoutForm } from "@/components/storefront/checkout-form";
import { getStorefrontShop } from "@/lib/storefront/queries";

export default async function ShopCheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getStorefrontShop(slug);
  if (!shop) return null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Checkout</h1>
      <p className="text-muted-foreground text-sm">
        {shop.orderNotice ?? "We will contact you to confirm delivery."}
      </p>
      <CheckoutForm
        shopSlug={shop.slug}
        delivery={shop.delivery}
        enableTakeaway={shop.enableTakeaway}
        enableOnlinePayment={shop.enableOnlinePayment}
      />
    </div>
  );
}
