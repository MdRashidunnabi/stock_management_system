import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CartProvider } from "@/components/storefront/cart-context";
import { ShopLayoutClient } from "@/components/storefront/shop-layout-client";
import { getStorefrontShop, listStorefrontCategories } from "@/lib/storefront/queries";

export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const branchCookie = cookieStore.get(`shop-branch-${slug}`)?.value;
  const shop = await getStorefrontShop(slug, branchCookie);
  if (!shop) notFound();

  const categories = await listStorefrontCategories(shop);

  return (
    <CartProvider shopSlug={shop.slug}>
      <ShopLayoutClient shop={shop} categories={categories}>
        {children}
      </ShopLayoutClient>
    </CartProvider>
  );
}
