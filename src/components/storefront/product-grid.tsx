import { ProductCard } from "@/components/storefront/product-card";
import type { StorefrontProduct } from "@/lib/storefront/queries";

export function ProductGrid({
  shopSlug,
  products,
}: {
  shopSlug: string;
  products: StorefrontProduct[];
}) {
  if (products.length === 0) {
    return (
      <p className="text-muted-foreground rounded-2xl border border-dashed py-16 text-center text-sm">
        No products in this category yet. Check back soon.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} shopSlug={shopSlug} product={p} />
      ))}
    </div>
  );
}
