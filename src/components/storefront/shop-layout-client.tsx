"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/components/storefront/cart-context";
import { ShopCatalogShell } from "@/components/storefront/shop-catalog-shell";
import { ShopFooter } from "@/components/storefront/shop-footer";
import { ShopHeader } from "@/components/storefront/shop-header";
import { StorefrontBranchPicker } from "@/components/storefront/storefront-branch-picker";
import type { StorefrontCategory, StorefrontShop } from "@/lib/storefront/queries";
import { getShopTemplate } from "@/lib/storefront/templates";

import { ShopMoneyProvider } from "@/components/storefront/shop-money";

type Props = {
  shop: StorefrontShop;
  categories: StorefrontCategory[];
  children: React.ReactNode;
};

export function ShopLayoutClient(props: Props) {
  return (
    <Suspense fallback={<ShopLayoutInner {...props} />}>
      <ShopLayoutWithPreview {...props} />
    </Suspense>
  );
}

function ShopLayoutWithPreview(props: Props) {
  const searchParams = useSearchParams();
  return <ShopLayoutInner {...props} previewId={searchParams.get("design")} />;
}

function ShopLayoutInner({
  shop,
  categories,
  children,
  previewId,
}: Props & { previewId?: string | null }) {
  const { itemCount, ready: cartReady } = useCart();
  const theme = getShopTemplate(previewId ?? shop.themeId);

  return (
    <ShopMoneyProvider currency={shop.currency} locale={shop.locale}>
      <div
        className="bg-background text-foreground flex min-h-dvh flex-col"
        data-shop-theme={theme.id}
        data-shop-nav={theme.nav}
        data-shop-hero={theme.hero}
        data-shop-header={theme.header}
        data-shop-density={theme.density}
      >
        <ShopHeader shop={shop} categories={categories} cartCount={cartReady ? itemCount : 0} />
        <div className="shop-shell mx-auto w-full max-w-6xl px-4 sm:px-6">
          <StorefrontBranchPicker
            slug={shop.slug}
            branches={shop.branches}
            currentBranchId={shop.branchId}
          />
        </div>
        <div className="shop-shell mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
          <ShopCatalogShell shopSlug={shop.slug} categories={categories} nav={theme.nav}>
            {children}
          </ShopCatalogShell>
        </div>
        <ShopFooter shop={shop} categories={categories} />
      </div>
    </ShopMoneyProvider>
  );
}
