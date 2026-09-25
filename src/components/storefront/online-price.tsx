"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OnlinePriceDisplay } from "@/lib/storefront/pricing";
import { useShopMoney } from "@/components/storefront/shop-money";

interface Props {
  pricing: OnlinePriceDisplay;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function OnlinePrice({ pricing, size = "md", className }: Props) {
  const money = useShopMoney();
  const priceClass =
    size === "lg"
      ? "text-3xl font-bold"
      : size === "sm"
        ? "text-base font-bold"
        : "text-lg font-bold";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {pricing.discountPct != null ? (
        <Badge variant="destructive" className="bg-destructive/90 shrink-0 font-semibold">
          -{pricing.discountPct}%
        </Badge>
      ) : null}
      <div className="flex flex-wrap items-baseline gap-2">
        {pricing.compareAtPrice != null ? (
          <span className="text-muted-foreground text-sm font-medium line-through decoration-2">
            {money(pricing.compareAtPrice)}
          </span>
        ) : null}
        <span className={cn("text-primary tracking-tight", priceClass)}>
          {money(pricing.price)}
        </span>
      </div>
    </div>
  );
}
