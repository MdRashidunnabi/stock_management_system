import type { StorefrontShop } from "@/lib/storefront/queries";

export function ShopHero({ shop }: { shop: StorefrontShop }) {
  const title = shop.heroTitle ?? shop.publicSiteName;
  const subtitle = shop.heroSubtitle ?? shop.tagline ?? "Order for delivery or collection";
  return (
    <section className="relative overflow-hidden rounded-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/needs-hero.jpg" alt="" className="h-40 w-full object-cover md:h-52" />
      <div className="absolute inset-x-3 bottom-3 rounded-lg bg-black/45 px-4 py-2 text-white md:inset-x-6">
        <p className="text-sm font-bold md:text-lg">{title}</p>
        <p className="text-xs text-white/85 md:text-sm">{subtitle}</p>
      </div>
    </section>
  );
}
