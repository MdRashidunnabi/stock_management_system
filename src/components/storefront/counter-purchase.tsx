"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/components/storefront/cart-context";
import type { StorefrontProduct } from "@/lib/storefront/queries";
import {
  WEIGHTS_KG,
  counterLineName,
  cutsForCode,
  isWholeFishCut,
  lineIdFor,
} from "@/lib/storefront/cuts";
import { formatEuro } from "@/lib/utils";

export function CounterPurchase({
  shopSlug,
  product,
}: {
  shopSlug: string;
  product: StorefrontProduct;
}) {
  const { addLine, itemCount } = useCart();
  const cuts = cutsForCode(product.barcode, product.sku);
  const [cutId, setCutId] = useState(cuts.length === 1 ? (cuts[0]?.id ?? "") : "");
  const [kg, setKg] = useState(1);
  const [note, setNote] = useState("");
  const cut = cuts.find((c) => c.id === cutId);
  const estimate = useMemo(
    () => Math.round(product.onlinePrice * kg * 100) / 100,
    [product.onlinePrice, kg],
  );
  const canAdd = cuts.length === 0 || Boolean(cutId);

  function addToBag() {
    if (!canAdd) return;
    addLine({
      productId: product.id,
      lineKey: lineIdFor(product.id, cutId || undefined),
      name: counterLineName(product.name, cut?.label, kg),
      unitPrice: product.onlinePrice,
      imageUrl: product.primaryImageUrl,
      maxQty: Math.max(product.available, kg),
      qty: kg,
      cutLabel: [cut?.label, note.trim()].filter(Boolean).join(". "),
    });
    toast.success("Added to cart");
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-sm">
        {isWholeFishCut(cut?.label)
          ? "This price is an estimate. The final price for whole fish is set after we measure and weigh it, and we will tell you."
          : product.categoryName?.toLowerCase().includes("fish")
            ? "Fish is cut to order. Choose one cut and a weight. We weigh it in the shop and confirm the price."
            : "Choose how you want it cut. Price is estimated per kg until we weigh it."}
      </p>
      {cuts.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">How should we cut it? Pick one.</legend>
          {cuts.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer gap-2 rounded-xl border p-3 ${cutId === option.id ? "border-primary bg-primary/5" : ""}`}
            >
              <input
                type="radio"
                name="cut"
                checked={cutId === option.id}
                onChange={() => setCutId(option.id)}
              />
              <span>
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="text-muted-foreground text-xs">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">How much?</legend>
        <div className="flex flex-wrap gap-2">
          {WEIGHTS_KG.map((weight) => (
            <button
              key={weight}
              type="button"
              onClick={() => setKg(weight)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${kg === weight ? "border-primary bg-primary/10" : ""}`}
            >
              {weight} kg
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-semibold">
        Extra instruction
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. no head, keep the bones"
          className="mt-1 font-normal"
        />
      </label>
      <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-3">
        <span className="text-sm font-semibold">Estimated</span>
        <span className="text-xl font-bold">{formatEuro(estimate)}</span>
      </div>
      <Button type="button" className="w-full" disabled={!canAdd} onClick={addToBag}>
        Add {kg} kg
      </Button>
      {itemCount > 0 ? (
        <Button asChild variant="outline" className="w-full">
          <Link href={`/shop/${shopSlug}/cart`}>
            <ShoppingCart className="size-4" />
            View cart ({itemCount})
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
