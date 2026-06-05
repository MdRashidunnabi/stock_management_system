"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { QuantityStepper } from "@/components/storefront/quantity-stepper";
import { useCart } from "@/components/storefront/cart-context";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/utils";

export function CartShell({ shopSlug }: { shopSlug: string }) {
  const { lines, subtotal, setQty, removeLine } = useCart();

  if (lines.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-white py-16 text-center dark:bg-stone-900">
        <p className="text-muted-foreground mb-4">Your cart is empty.</p>
        <Button asChild className="bg-primary hover:bg-primary/90 rounded-full">
          <Link href={`/shop/${shopSlug}`}>Browse products</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ul className="divide-y overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-stone-900">
        {lines.map((line) => (
          <li key={line.productId} className="flex gap-4 p-4">
            <div className="bg-background size-20 shrink-0 overflow-hidden rounded-xl dark:bg-stone-800">
              {line.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={line.imageUrl} alt="" className="size-full object-contain p-1" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-semibold text-stone-900 dark:text-stone-50">{line.name}</p>
              <p className="text-primary dark:text-success">{formatEuro(line.unitPrice)} each</p>
              <div className="flex flex-wrap items-center gap-2">
                <QuantityStepper
                  size="sm"
                  value={line.qty}
                  max={line.maxQty}
                  min={0}
                  className="max-w-[140px]"
                  onChange={(n) => setQty(line.productId, n)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-stone-500"
                  aria-label="Remove"
                  onClick={() => removeLine(line.productId)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            <p className="shrink-0 font-bold">{formatEuro(line.unitPrice * line.qty)}</p>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between rounded-2xl border bg-white px-4 py-3 dark:bg-stone-900">
        <span className="font-medium">Subtotal</span>
        <span className="text-primary text-xl font-bold">{formatEuro(subtotal)}</span>
      </div>

      <Button asChild size="lg" className="bg-primary hover:bg-primary/90 w-full rounded-full">
        <Link href={`/shop/${shopSlug}/checkout`}>Go to checkout</Link>
      </Button>
    </div>
  );
}
