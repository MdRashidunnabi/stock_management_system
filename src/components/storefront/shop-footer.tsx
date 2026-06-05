import Link from "next/link";
import { Suspense } from "react";
import { ShopSearchBar } from "@/components/storefront/shop-search-bar";
import type { StorefrontCategory, StorefrontShop } from "@/lib/storefront/queries";

interface Props {
  shop: StorefrontShop;
  categories: StorefrontCategory[];
}

const SOCIAL_STYLES = {
  Facebook: { short: "f", className: "bg-[#1877F2]" },
  Twitter: { short: "𝕏", className: "bg-[#1DA1F2]" },
  YouTube: { short: "▶", className: "bg-[#FF0000]" },
  Instagram: { short: "◎", className: "bg-gradient-to-br from-[#f58529] to-[#dd2a7b]" },
} as const;

export function ShopFooter({ shop, categories }: Props) {
  const base = `/shop/${shop.slug}`;

  const socials = [
    { url: shop.facebookUrl, label: "Facebook" as const },
    { url: shop.twitterUrl, label: "Twitter" as const },
    { url: shop.youtubeUrl, label: "YouTube" as const },
    { url: shop.instagramUrl, label: "Instagram" as const },
  ].filter((s) => s.url?.trim());

  return (
    <footer className="border-border/80 bg-card mt-12 border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:gap-10">
        <div className="space-y-3">
          <h2 className="text-base font-bold">About {shop.publicSiteName}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {shop.footerAbout ??
              `${shop.publicSiteName} — quality groceries and international foods, with live stock from our shop.`}
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-bold">Useful links</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href={base} className="text-info font-medium hover:underline">
                Home
              </Link>
            </li>
            <li>
              <Link href={`${base}/search`} className="text-info font-medium hover:underline">
                Shop
              </Link>
            </li>
            <li>
              <Link href={`${base}#about`} className="text-info font-medium hover:underline">
                About us
              </Link>
            </li>
            <li>
              <a
                href={shop.phone ? `tel:${shop.phone.replace(/\s/g, "")}` : "#contact"}
                className="text-info font-medium hover:underline"
              >
                Contact
              </a>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-bold">Search</h2>
          <Suspense fallback={<div className="bg-muted/40 h-11 animate-pulse rounded-full" />}>
            <ShopSearchBar
              shopSlug={shop.slug}
              categories={categories}
              phone={null}
              callUsLabel={null}
            />
          </Suspense>
        </div>

        <div className="space-y-3" id="contact">
          <h2 className="text-base font-bold">Social profiles</h2>
          {socials.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {socials.map((s) => {
                const style = SOCIAL_STYLES[s.label];
                return (
                  <a
                    key={s.label}
                    href={s.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${style.className} flex size-10 items-center justify-center rounded-md text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90`}
                    aria-label={s.label}
                  >
                    {style.short}
                  </a>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Add social links in Shop settings.</p>
          )}
          {shop.phone ? (
            <p className="text-sm">
              <span className="text-muted-foreground">Phone: </span>
              <a href={`tel:${shop.phone.replace(/\s/g, "")}`} className="text-info font-medium">
                {shop.phone}
              </a>
            </p>
          ) : null}
          {shop.whatsapp ? (
            <p className="text-sm">
              <span className="text-muted-foreground">WhatsApp: </span>
              <a
                href={`https://wa.me/${shop.whatsapp.replace(/\D/g, "")}`}
                className="text-info font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                {shop.whatsapp}
              </a>
            </p>
          ) : null}
        </div>
      </div>
      <div className="text-muted-foreground border-border/60 border-t py-4 text-center text-xs">
        {shop.publicSiteName} · Live stock · Powered by ShopOS
      </div>
    </footer>
  );
}
