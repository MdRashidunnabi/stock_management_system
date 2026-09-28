"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPublicOrderTrackingAction } from "@/lib/storefront/track-action";
import { fulfillmentStageLabel, lineStatusLabel } from "@/lib/storefront/fulfillment";

export function OrderTrackForm({
  shopSlug,
  initialOrder,
}: {
  shopSlug: string;
  initialOrder?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof getPublicOrderTrackingAction>
  > | null>(null);

  return (
    <div className="space-y-6">
      <form
        className="bg-card space-y-4 rounded-2xl border p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const res = await getPublicOrderTrackingAction({
              shopSlug,
              orderNumber: String(fd.get("order") ?? ""),
              phone: String(fd.get("phone") ?? ""),
            });
            if (!res.ok) {
              setResult(null);
              setError(res.error);
              return;
            }
            setResult(res);
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="order">Order number</Label>
          <Input id="order" name="order" required defaultValue={initialOrder} placeholder="WEB-…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone used at checkout</Label>
          <Input id="phone" name="phone" type="tel" required autoComplete="tel" />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          Track order
        </Button>
      </form>

      {result?.ok ? (
        <div className="bg-card space-y-3 rounded-2xl border p-5 shadow-sm">
          <p className="font-mono text-sm font-semibold">{result.order.orderNumber}</p>
          <p className="text-lg font-semibold">{fulfillmentStageLabel(result.order.stage)}</p>
          <p className="text-muted-foreground text-sm capitalize">
            {result.order.fulfillmentType === "takeaway" ? "Collection" : "Delivery"}
            {result.order.isAdvance && result.order.wantedForDate
              ? ` · wanted ${result.order.wantedForDate}`
              : ""}
          </p>
          <ul className="space-y-1 text-sm">
            {result.order.items.map((item, i) => (
              <li key={`${item.name}-${i}`} className="flex justify-between gap-3">
                <span>
                  {item.name} × {item.qty}
                </span>
                <span className="text-muted-foreground text-xs">
                  {lineStatusLabel(item.lineStatus)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
