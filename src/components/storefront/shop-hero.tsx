import type { StorefrontShop } from "@/lib/storefront/queries";

export function ShopHero({ shop }: { shop: StorefrontShop }) {
  return (
    <section className="shop-hero relative overflow-hidden px-6 py-10 shadow-lg sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-black/10 blur-3xl" />
      <div className="relative max-w-xl space-y-3">
        <p className="text-xs font-medium tracking-widest uppercase opacity-90">Online shop</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {shop.heroTitle ?? `Welcome to ${shop.publicSiteName}`}
        </h1>
        <p className="text-sm leading-relaxed opacity-95 sm:text-base">
          {shop.heroSubtitle ??
            "Everyday essentials with live stock from our shop — order for delivery or collection."}
        </p>
      </div>
    </section>
  );
}
