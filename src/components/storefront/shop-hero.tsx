import type { StorefrontShop } from "@/lib/storefront/queries";

export function ShopHero({ shop }: { shop: StorefrontShop }) {
  return (
    <section className="from-primary via-brand-700 to-info relative overflow-hidden rounded-2xl bg-gradient-to-br px-6 py-10 text-white shadow-lg sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-white/10 blur-2xl" />
      <div className="bg-info/30 pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full blur-3xl" />
      <div className="relative max-w-xl space-y-3">
        <p className="text-primary-foreground/90 text-xs font-medium tracking-widest uppercase">
          Online grocery · Carlow
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {shop.heroTitle ?? `Welcome to ${shop.publicSiteName}`}
        </h1>
        <p className="text-primary-foreground/95 text-sm leading-relaxed sm:text-base">
          {shop.heroSubtitle ??
            "Fresh produce, international groceries, and everyday essentials — order for delivery or collection."}
        </p>
      </div>
    </section>
  );
}
