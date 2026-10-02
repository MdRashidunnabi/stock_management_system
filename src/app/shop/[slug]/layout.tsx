import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CartProvider } from "@/components/storefront/cart-context";
import { ShopLayoutClient } from "@/components/storefront/shop-layout-client";
import { getStorefrontShop, listStorefrontBrowseNav } from "@/lib/storefront/queries";

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

  const browse = await listStorefrontBrowseNav(shop);

  return (
    <CartProvider shopSlug={shop.slug}>
      <ShopLayoutClient
        shop={shop}
        categories={browse.items}
        navHref={browse.hrefSegment}
        navLabel={browse.label}
      >
        {children}
      </ShopLayoutClient>
    </CartProvider>
  );
}
