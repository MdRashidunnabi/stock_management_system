"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/storefront/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { placeOnlineOrderAction } from "@/lib/storefront/actions";
import {
  calculateDeliveryQuote,
  calculateOrderTotal,
  type DeliverySettings,
  type FulfillmentType,
} from "@/lib/storefront/delivery";
import { cn, formatEuro } from "@/lib/utils";

type PaymentMethod = "cod" | "online_card";

interface Props {
  shopSlug: string;
  delivery: DeliverySettings;
  enableTakeaway: boolean;
  enableOnlinePayment: boolean;
}

function minPickupLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CheckoutForm({ shopSlug, delivery, enableTakeaway, enableOnlinePayment }: Props) {
  const router = useRouter();
  const { lines, subtotal, clear } = useCart();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("delivery");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");

  const quote = useMemo(
    () => calculateDeliveryQuote(subtotal, fulfillment, delivery),
    [subtotal, fulfillment, delivery],
  );
  const orderTotal = useMemo(() => calculateOrderTotal(subtotal, quote.fee), [subtotal, quote.fee]);
  const belowMin = subtotal > 0 && subtotal < delivery.minOrder;

  if (lines.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Your cart is empty.{" "}
        <a href={`/shop/${shopSlug}`} className="text-primary underline">
          Continue shopping
        </a>
      </p>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const clientUuid = crypto.randomUUID();
    const f = (fd.get("fulfillment") as FulfillmentType) || fulfillment;
    const pay = (fd.get("payment_method") as PaymentMethod) || paymentMethod;
    let pickupAt = String(fd.get("pickup_at") ?? "");
    if (f === "takeaway" && pickupAt) {
      pickupAt = new Date(pickupAt).toISOString();
    }

    startTransition(async () => {
      const res = await placeOnlineOrderAction({
        shopSlug,
        items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        customerName: String(fd.get("name") ?? ""),
        customerPhone: String(fd.get("phone") ?? ""),
        customerEmail: String(fd.get("email") ?? ""),
        fulfillment: f,
        paymentMethod: pay,
        deliveryAddress: f === "delivery" ? String(fd.get("address") ?? "") : undefined,
        pickupAt: f === "takeaway" ? pickupAt : undefined,
        notes: String(fd.get("notes") ?? ""),
        clientUuid,
      });

      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }

      clear();
      toast.success("Order placed!");
      const params = new URLSearchParams({
        order: res.orderNumber,
        total: String(res.total),
        fulfillment: f,
        payment: pay,
      });
      if (res.deliveryFee > 0) params.set("delivery", String(res.deliveryFee));
      router.push(`/shop/${shopSlug}/order/success?${params.toString()}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="bg-background/80 rounded-xl border border-stone-200 p-4 dark:border-stone-800 dark:bg-stone-900/40">
        <p className="text-sm font-medium text-stone-800 dark:text-stone-200">Order summary</p>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Products</dt>
            <dd className="font-mono">{formatEuro(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="font-mono">
              {quote.fee === 0 ? <span className="text-primary">Free</span> : formatEuro(quote.fee)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-2 dark:border-stone-700">
            <dt className="font-semibold">Total</dt>
            <dd className="text-primary text-primary text-lg font-bold">
              {formatEuro(orderTotal)}
            </dd>
          </div>
        </dl>
        <p className="text-muted-foreground mt-2 text-xs">{quote.label}</p>
        {belowMin && fulfillment === "delivery" ? (
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
            Minimum order for delivery is €{delivery.minOrder.toFixed(2)} (you can still checkout).
          </p>
        ) : null}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">How would you like your order?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label
            className={cn(
              "flex cursor-pointer flex-col rounded-lg border p-3 text-sm transition-colors",
              fulfillment === "delivery"
                ? "border-primary bg-primary/10/60 dark:bg-primary/20"
                : "hover:bg-background border-stone-200 dark:border-stone-700",
            )}
          >
            <input
              type="radio"
              name="fulfillment"
              value="delivery"
              className="sr-only"
              checked={fulfillment === "delivery"}
              onChange={() => setFulfillment("delivery")}
            />
            <span className="font-medium">Home delivery</span>
            <span className="text-muted-foreground text-xs">
              €{delivery.standardFee.toFixed(2)} fee, free over €{delivery.freeOver.toFixed(0)}
            </span>
          </label>
          {enableTakeaway ? (
            <label
              className={cn(
                "flex cursor-pointer flex-col rounded-lg border p-3 text-sm transition-colors",
                fulfillment === "takeaway"
                  ? "border-primary bg-primary/10/60 dark:bg-primary/20"
                  : "hover:bg-background border-stone-200 dark:border-stone-700",
              )}
            >
              <input
                type="radio"
                name="fulfillment"
                value="takeaway"
                className="sr-only"
                checked={fulfillment === "takeaway"}
                onChange={() => setFulfillment("takeaway")}
              />
              <span className="font-medium">Takeaway / collection</span>
              <span className="text-muted-foreground text-xs">
                Collect in store — no delivery fee
              </span>
            </label>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Payment</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label
            className={cn(
              "flex cursor-pointer flex-col rounded-lg border p-3 text-sm",
              paymentMethod === "cod"
                ? "border-primary bg-primary/10/60 dark:bg-primary/20"
                : "border-stone-200",
            )}
          >
            <input
              type="radio"
              name="payment_method"
              value="cod"
              className="sr-only"
              checked={paymentMethod === "cod"}
              onChange={() => setPaymentMethod("cod")}
            />
            <span className="font-medium">Cash on delivery</span>
            <span className="text-muted-foreground text-xs">
              Pay when we deliver or you collect
            </span>
          </label>
          {enableOnlinePayment ? (
            <label
              className={cn(
                "flex cursor-pointer flex-col rounded-lg border p-3 text-sm",
                paymentMethod === "online_card"
                  ? "border-primary bg-primary/10/60 dark:bg-primary/20"
                  : "border-stone-200",
              )}
            >
              <input
                type="radio"
                name="payment_method"
                value="online_card"
                className="sr-only"
                checked={paymentMethod === "online_card"}
                onChange={() => setPaymentMethod("online_card")}
              />
              <span className="font-medium">Pay online (card)</span>
              <span className="text-muted-foreground text-xs">
                We will send a secure payment link after confirming your order
              </span>
            </label>
          ) : null}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Full name *</Label>
          <Input id="name" name="name" required autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone *</Label>
          <Input id="phone" name="phone" type="tel" required autoComplete="tel" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" />
        </div>

        {fulfillment === "delivery" ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Delivery address *</Label>
            <Textarea
              id="address"
              name="address"
              required
              rows={2}
              placeholder="Street, town, county, Eircode"
            />
          </div>
        ) : (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="pickup_at">When will you collect? *</Label>
            <Input
              id="pickup_at"
              name="pickup_at"
              type="datetime-local"
              required
              min={minPickupLocal()}
            />
            <p className="text-muted-foreground text-xs">
              Choose the date and time you plan to arrive at the shop.
            </p>
          </div>
        )}

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={2}
            placeholder={
              fulfillment === "delivery"
                ? "Preferred delivery time, gate code, etc."
                : "Car colour, anyone else collecting, etc."
            }
          />
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Button
        type="submit"
        size="lg"
        className="bg-primary hover:bg-primary/90 w-full"
        disabled={pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Place order — {formatEuro(orderTotal)}
      </Button>
    </form>
  );
}
