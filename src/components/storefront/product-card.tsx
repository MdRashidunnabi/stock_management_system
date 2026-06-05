"use client";

import Link from "next/link";
import { toast } from "sonner";
import { OnlinePrice } from "@/components/storefront/online-price";
import { QuantityStepper } from "@/components/storefront/quantity-stepper";
import { StockBadge } from "@/components/storefront/stock-badge";
import { useCart } from "@/components/storefront/cart-context";
import type { StorefrontProduct } from "@/lib/storefront/queries";

interface Props {
  shopSlug: string;
  product: StorefrontProduct;
}

export function ProductCard({ shopSlug, product }: Props) {
  const { lines, addLine, setQty } = useCart();
  const href = `/shop/${shopSlug}/product/${product.id}`;
  const max = Math.floor(product.available);
  const canBuy = product.stock.canAddToCart && max > 0;
  const cartQty = lines.find((l) => l.productId === product.id)?.qty ?? 0;
  const displayQty = canBuy ? (cartQty > 0 ? cartQty : 0) : 0;

  function updateQty(next: number) {
    if (!canBuy) return;
    if (next <= 0) {
      setQty(product.id, 0);
      return;
    }
    if (cartQty === 0) {
      addLine({
        productId: product.id,
        name: product.name,
        unitPrice: product.onlinePrice,
        imageUrl: product.primaryImageUrl,
        maxQty: max,
        qty: next,
      });
      toast.success("Added to cart");
    } else {
      setQty(product.id, next);
    }
  }

  return (
    <article className="bg-card border-border/80 flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-md">
      <Link href={href} className="block">
        <div className="bg-background relative aspect-[4/3]">
          {product.primaryImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.primaryImageUrl}
              alt={product.name}
              className="size-full object-contain p-3"
            />
          ) : (
            <div className="text-muted-foreground flex size-full items-center justify-center text-sm">
              No image
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 px-3 pt-3 pb-3">
        <StockBadge stock={product.stock} />

        <Link href={href} className="hover:text-primary">
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold">{product.name}</h3>
        </Link>

        <OnlinePrice
          pricing={{
            price: product.onlinePrice,
            compareAtPrice: product.compareAtPrice,
            discountPct: product.discountPct,
            baseOnlinePrice: product.compareAtPrice ?? product.onlinePrice,
          }}
          size="sm"
        />

        {canBuy ? (
          <QuantityStepper
            value={displayQty}
            max={max}
            min={0}
            size="sm"
            className="mt-auto"
            onChange={updateQty}
          />
        ) : (
          <p className="text-muted-foreground mt-auto rounded-xl border border-dashed py-2.5 text-center text-xs">
            Out of stock — check back soon
          </p>
        )}
      </div>
    </article>
  );
}
