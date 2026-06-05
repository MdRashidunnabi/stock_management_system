"use client";

import { useCart } from "@/components/storefront/cart-context";
import { ShopCatalogShell } from "@/components/storefront/shop-catalog-shell";
import { ShopFooter } from "@/components/storefront/shop-footer";
import { ShopHeader } from "@/components/storefront/shop-header";
import { StorefrontBranchPicker } from "@/components/storefront/storefront-branch-picker";
import type { StorefrontCategory, StorefrontShop } from "@/lib/storefront/queries";

export function ShopLayoutClient({
  shop,
  categories,
  children,
}: {
  shop: StorefrontShop;
  categories: StorefrontCategory[];
  children: React.ReactNode;
}) {
  const { itemCount, ready: cartReady } = useCart();

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <ShopHeader shop={shop} categories={categories} cartCount={cartReady ? itemCount : 0} />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <StorefrontBranchPicker
          slug={shop.slug}
          branches={shop.branches}
          currentBranchId={shop.branchId}
        />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <ShopCatalogShell shopSlug={shop.slug} categories={categories}>
          {children}
        </ShopCatalogShell>
      </div>
      <ShopFooter shop={shop} categories={categories} />
    </div>
  );
}
