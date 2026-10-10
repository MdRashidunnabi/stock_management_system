import Link from "next/link";
import { MessageCircle, Search, ShoppingBag } from "lucide-react";
import { ShopBrandLogo } from "@/components/storefront/shop-brand-logo";
import type { StorefrontCategory, StorefrontShop } from "@/lib/storefront/queries";

interface Props {
  shop: StorefrontShop;
  categories: StorefrontCategory[];
  cartCount?: number;
  navHref?: "brand" | "category";
  navLabel?: string;
}

export function ShopHeader({ shop, cartCount = 0 }: Props) {
  const base = `/shop/${shop.slug}`;
  const whatsapp = shop.whatsapp?.replace(/\D/g, "");

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="shop-notice-bar text-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-3 py-1.5 text-xs sm:text-sm">
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
      </div>
      <div className="border-b border-black/5">
        <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-3 py-2 md:gap-3">
          <Link href={base} className="shrink-0" aria-label={shop.publicSiteName}>
            <ShopBrandLogo src={shop.logoUrl} name={shop.publicSiteName} />
          </Link>
          <form action={`${base}/search`} className="hidden min-w-0 flex-1 md:flex">
            <label className="flex w-full items-center rounded-lg border border-black/10 bg-[#fff8f0] px-3 py-2.5">
              <Search className="size-4 text-stone-500" />
              <input
                name="q"
                placeholder="Search products"
                className="ml-2 w-full bg-transparent text-sm outline-none"
              />
            </label>
          </form>
          <nav className="ml-auto flex shrink-0 items-center gap-1">
            <Link
              href={`${base}/advance`}
              className="hidden rounded-lg px-2 py-2 text-sm font-semibold hover:bg-[#fff8f0] sm:inline"
            >
              Advance Order
            </Link>
            <Link
              href={`${base}/order/track`}
              className="rounded-lg px-2 py-2 text-sm font-semibold hover:bg-[#fff8f0] sm:px-3"
            >
              Track
            </Link>
            {shop.phone ? (
              <a
                href={`tel:${shop.phone.replace(/\s/g, "")}`}
                className="hidden rounded-lg px-3 py-2 text-sm font-semibold hover:bg-[#fff8f0] sm:inline"
              >
                Contact
              </a>
            ) : null}
            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-bold text-white"
              >
                <MessageCircle className="size-4" />
                WhatsApp
              </a>
            ) : null}
          </nav>
          <Link
            href={`${base}/offers`}
            className="hidden rounded-lg bg-[#e23d3d] px-3 py-2 text-sm font-bold text-white sm:inline"
          >
            Offers
          </Link>
          <Link
            href={`${base}/cart`}
            className="relative rounded-lg bg-[#2ea043] p-2.5 text-white"
            aria-label="Bag"
          >
            <ShoppingBag className="size-5" />
            {cartCount > 0 ? (
              <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#e23d3d] px-1 text-[11px] font-bold">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
