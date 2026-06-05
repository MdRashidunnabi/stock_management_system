"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { QuantityStepper } from "@/components/storefront/quantity-stepper";
import { StockBadge } from "@/components/storefront/stock-badge";
import { useCart } from "@/components/storefront/cart-context";
import { Button } from "@/components/ui/button";
import type { StorefrontProduct } from "@/lib/storefront/queries";

export function ProductPurchasePanel({
  shopSlug,
  product,
}: {
  shopSlug: string;
  product: StorefrontProduct;
}) {
  const { lines, addLine, setQty, itemCount } = useCart();
  const max = Math.floor(product.available);
  const canBuy = product.stock.canAddToCart && max > 0;
  const cartQty = lines.find((l) => l.productId === product.id)?.qty ?? 0;
  const displayQty = canBuy ? (cartQty > 0 ? cartQty : 1) : 0;

  if (!canBuy) {
    return (
      <div className="space-y-3 rounded-2xl border border-dashed p-4">
        <StockBadge stock={product.stock} />
        <p className="text-muted-foreground text-sm">This item is not available right now.</p>
      </div>
    );
  }

  function updateQty(next: number) {
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
    <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm dark:bg-stone-900">
      <StockBadge stock={product.stock} />
      <QuantityStepper value={displayQty} max={max} min={1} onChange={updateQty} />
      <p className="text-muted-foreground text-xs">
        Use + and − to set how many you need (max {max}).
      </p>
      {itemCount > 0 ? (
        <Button asChild className="bg-primary hover:bg-primary/90 w-full rounded-full">
          <Link href={`/shop/${shopSlug}/cart`}>
            <ShoppingCart className="size-4" />
            View cart ({itemCount})
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
