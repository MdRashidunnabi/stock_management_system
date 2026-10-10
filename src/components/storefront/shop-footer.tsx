import Link from "next/link";
import { ShopBrandLogo } from "@/components/storefront/shop-brand-logo";
import type { StorefrontCategory, StorefrontShop } from "@/lib/storefront/queries";

export function ShopFooter({
  shop,
  categories,
  hrefSegment = "brand",
}: {
  shop: StorefrontShop;
  categories: StorefrontCategory[];
  hrefSegment?: "brand" | "category";
}) {
  const base = `/shop/${shop.slug}`;
  const whatsapp = shop.whatsapp?.replace(/\D/g, "");
  const year = new Date().getFullYear();

  return (
    <footer className="mt-8 bg-[#12301d] text-white">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="inline-block rounded bg-white p-1">
            <ShopBrandLogo src={shop.logoUrl} name={shop.publicSiteName} />
          </div>
          {shop.tagline ? (
            <p className="mt-3 text-sm font-semibold text-[#d6f5a2]">{shop.tagline}</p>
          ) : null}
          <p className="mt-2 text-sm text-white/75">
            {shop.footerAbout ??
              `${shop.publicSiteName} — fresh food, groceries, and weekly offers.`}
          </p>
        </div>
        <div>
          <p className="font-bold">Shop</p>
          <ul className="mt-3 space-y-1 text-sm text-white/80">
            {categories.slice(0, 12).map((c) => (
              <li key={c.id}>
                <Link href={`${base}/${hrefSegment}/${c.slug}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-bold">Help</p>
          <ul className="mt-3 space-y-1 text-sm text-white/80">
            <li>
              <Link href={`${base}/advance`}>Advance Order</Link>
            </li>
            <li>
              <Link href={`${base}/order/track`}>Track order</Link>
            </li>
            <li>
              <Link href={`${base}/offers`}>Offers</Link>
            </li>
            {shop.facebookUrl ? (
              <li>
                <a href={shop.facebookUrl} target="_blank" rel="noreferrer">
                  Facebook
                </a>
              </li>
            ) : null}
          </ul>
        </div>
        <div>
          <p className="font-bold">Visit us</p>
          {shop.heroSubtitle ? (
            <p className="mt-3 text-sm text-white/80">{shop.heroSubtitle}</p>
          ) : null}
          {shop.phone ? (
            <a
              href={`tel:${shop.phone.replace(/\s/g, "")}`}
              className="mt-3 block font-bold text-[#d6f5a2]"
            >
              {shop.phone}
            </a>
          ) : null}
          {whatsapp ? (
            <a
              href={`https://wa.me/${whatsapp}`}
              className="mt-3 inline-block rounded-lg bg-[#25D366] px-4 py-2 text-sm font-bold text-white"
            >
              WhatsApp
            </a>
          ) : null}
        </div>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {year} {shop.publicSiteName}
        {shop.tagline ? ` · ${shop.tagline}` : ""}
      </p>
    </footer>
  );
}
