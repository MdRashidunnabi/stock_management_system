import Link from "next/link";
import { Suspense } from "react";
import { MessageCircle, Phone, ShoppingCart } from "lucide-react";
import { ShopBrandLogo } from "@/components/storefront/shop-brand-logo";
import { ShopSearchBar } from "@/components/storefront/shop-search-bar";
import { Button } from "@/components/ui/button";
import type { StorefrontCategory, StorefrontShop } from "@/lib/storefront/queries";

interface Props {
  shop: StorefrontShop;
  categories: StorefrontCategory[];
  cartCount?: number;
  navHref?: "brand" | "category";
  navLabel?: string;
}

export function ShopHeader({
  shop,
  categories,
  cartCount = 0,
  navHref = "brand",
  navLabel = "Brands",
}: Props) {
  const base = `/shop/${shop.slug}`;

  return (
    <header className="bg-card/95 border-border/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="shop-notice-bar flex items-center justify-between gap-3 px-4 py-2 text-xs font-medium text-white">
        <p>{shop.orderNotice ?? "Free delivery over the shop minimum. Fresh food every week."}</p>
        {shop.phone ? (
          <a
            href={`tel:${shop.phone.replace(/\s/g, "")}`}
            className="hidden font-semibold sm:inline"
          >
            {shop.phone}
          </a>
        ) : null}
      </div>
      <div className="shop-shell mx-auto max-w-6xl space-y-3 px-4 py-3 sm:px-6">
        <div className="shop-header-row flex items-center justify-between gap-3">
          <Link href={base} className="shop-brand flex min-w-0 shrink-0 items-center">
            <ShopBrandLogo src={shop.logoUrl} name={shop.publicSiteName} />
          </Link>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="hidden rounded-full sm:inline-flex"
              asChild
            >
              <Link href={`${base}/order/track`}>Track</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden rounded-full sm:inline-flex"
              asChild
            >
              <Link href={`${base}/offers`}>Offers</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden rounded-full sm:inline-flex"
              asChild
            >
              <Link href={`${base}/advance`}>Advance Order</Link>
            </Button>
            {shop.phone ? (
              <Button variant="ghost" size="icon" className="rounded-full lg:hidden" asChild>
                <a href={`tel:${shop.phone.replace(/\s/g, "")}`} aria-label="Call shop">
                  <Phone className="size-4" />
                </a>
              </Button>
            ) : null}
            {shop.whatsapp ? (
              <Button
                variant="ghost"
                size="icon"
                className="hidden rounded-full sm:inline-flex"
                asChild
              >
                <a
                  href={`https://wa.me/${shop.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="size-4" />
                </a>
              </Button>
            ) : null}
            <Button size="sm" className="relative gap-2 rounded-full px-4" asChild>
              <Link href={`${base}/cart`}>
                <ShoppingCart className="size-4" />
                <span className="hidden sm:inline">Bag</span>
                {cartCount > 0 ? (
                  <span className="bg-background text-primary absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold shadow">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                ) : null}
              </Link>
            </Button>
          </div>
        </div>

        <Suspense fallback={<div className="bg-muted/40 h-11 animate-pulse rounded-full" />}>
          <ShopSearchBar
            shopSlug={shop.slug}
            categories={categories}
            phone={shop.phone}
            callUsLabel={shop.callUsLabel}
            filterParam={navHref}
            filterLabel={navLabel}
          />
        </Suspense>
      </div>
    </header>
  );
}
