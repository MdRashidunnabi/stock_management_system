import { CartShell } from "@/components/storefront/cart-shell";
import { getStorefrontShop } from "@/lib/storefront/queries";

export default async function ShopCartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getStorefrontShop(slug);
  if (!shop) return null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-50">Your cart</h1>
      <p className="text-muted-foreground text-sm">Change quantities with + / − before checkout.</p>
      <CartShell shopSlug={shop.slug} />
    </div>
  );
}
