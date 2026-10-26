"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Loader2, Truck, Store } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/storefront/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { placeOnlineOrderAction } from "@/lib/storefront/actions";
import {
  calculateDeliveryQuote,
  quoteDeliveryArea,
  type DeliveryArea,
  type DeliverySettings,
  type FulfillmentType,
} from "@/lib/storefront/delivery";
import { isWholeFishCut } from "@/lib/storefront/cuts";
import { MIN_ADVANCE_DAYS, minAdvanceDateYmd } from "@/lib/reports/period";
import { cn } from "@/lib/utils";
import { useShopMoney } from "@/components/storefront/shop-money";
import { quoteStorefrontVoucher } from "@/lib/storefront/actions";
import { orderTotalAfterVoucher } from "@/lib/vouchers/rules";

type PaymentMethod = "cod" | "online_card";
type CheckoutStep = "options" | "details";
type CheckoutMethod = "delivery_cod" | "delivery_card" | "takeaway_cod" | "takeaway_card";

function checkoutMethodOf(fulfillment: FulfillmentType, payment: PaymentMethod): CheckoutMethod {
  const place = fulfillment === "takeaway" ? "takeaway" : "delivery";
  const pay = payment === "online_card" ? "card" : "cod";
  return `${place}_${pay}`;
}

function applyCheckoutMethod(method: CheckoutMethod): {
  fulfillment: FulfillmentType;
  paymentMethod: PaymentMethod;
} {
  return {
    fulfillment: method.startsWith("takeaway") ? "takeaway" : "delivery",
    paymentMethod: method.endsWith("card") ? "online_card" : "cod",
  };
}

interface Props {
  shopSlug: string;
  delivery: DeliverySettings;
  deliveryAreas: DeliveryArea[];
  enableTakeaway: boolean;
  enableOnlinePayment: boolean;
}

function minPickupLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ChoiceCard({
  selected,
  title,
  description,
  icon,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      onClick={onSelect}
      aria-checked={selected}
      className={cn(
        "flex cursor-pointer flex-col rounded-xl border-2 p-4 text-left text-sm transition-all",
        selected
          ? "border-primary bg-primary/15 ring-primary/40 text-foreground ring-2"
          : "hover:border-primary/40 border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900",
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold">
          <span className={cn("shrink-0", selected ? "text-primary" : "text-muted-foreground")}>
            {icon}
          </span>
          {title}
        </span>
        {selected ? (
          <CheckCircle2 className="text-primary size-5 shrink-0" aria-hidden />
        ) : (
          <span
            className="border-muted-foreground/30 mt-0.5 size-5 shrink-0 rounded-full border-2"
            aria-hidden
          />
        )}
      </span>
      <span className="text-muted-foreground mt-1.5 text-xs leading-relaxed">{description}</span>
    </button>
  );
}

export function CheckoutForm({
  shopSlug,
  delivery,
  deliveryAreas,
  enableTakeaway,
  enableOnlinePayment,
}: Props) {
  const router = useRouter();
  const { lines, subtotal, clear, wantedForDate, isAdvance, setWantedForDate } = useCart();
  const money = useShopMoney();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<CheckoutStep>("options");
  const [redirecting, setRedirecting] = useState(false);
  const [areaId, setAreaId] = useState(deliveryAreas[0]?.id ?? "");
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("delivery");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const minAdvance = minAdvanceDateYmd();
  const selectedMethod = checkoutMethodOf(fulfillment, paymentMethod);

  function selectCheckout(method: CheckoutMethod) {
    const next = applyCheckoutMethod(method);
    setFulfillment(next.fulfillment);
    setPaymentMethod(next.paymentMethod);
  }

  const area = deliveryAreas.find((row) => row.id === areaId) ?? deliveryAreas[0] ?? null;
  const quote = useMemo(() => {
    if (fulfillment === "delivery" && area) return quoteDeliveryArea(subtotal, fulfillment, area);
    return calculateDeliveryQuote(subtotal, fulfillment, delivery);
  }, [subtotal, fulfillment, delivery, area]);
  const orderTotal = useMemo(
    () => orderTotalAfterVoucher(subtotal, quote.fee, discount),
    [subtotal, quote.fee, discount],
  );
  const belowMin = fulfillment === "delivery" && area != null && subtotal + 0.009 < area.minOrder;
  const wholeFish = lines.some(
    (line) => isWholeFishCut(line.cutLabel) || isWholeFishCut(line.name),
  );

  if (redirecting) {
    return <p className="text-muted-foreground text-sm">Taking you to your order confirmation…</p>;
  }

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
    if (step !== "details") {
      if (belowMin) return;
      setStep("details");
      return;
    }
    if (belowMin) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const clientUuid = crypto.randomUUID();
    let pickupAt = String(fd.get("pickup_at") ?? "");
    if (fulfillment === "takeaway" && pickupAt) {
      pickupAt = new Date(pickupAt).toISOString();
    }

    startTransition(async () => {
      const res = await placeOnlineOrderAction({
        shopSlug,
        items: lines.map((l) => ({
          productId: l.productId,
          cutLabel: l.cutLabel || "",
          qty: l.qty,
          ifUnavailable: l.ifUnavailable,
        })),
        customerName: String(fd.get("name") ?? ""),
        customerPhone: String(fd.get("phone") ?? ""),
        customerEmail: String(fd.get("email") ?? ""),
        fulfillment,
        paymentMethod,
        deliveryAddress: fulfillment === "delivery" ? String(fd.get("address") ?? "") : undefined,
        pickupAt: fulfillment === "takeaway" ? pickupAt : undefined,
        deliveryAreaId: fulfillment === "delivery" ? area?.id : undefined,
        notes: String(fd.get("notes") ?? ""),
        clientUuid,
        wantedForDate: wantedForDate || undefined,
        isAdvance: Boolean(wantedForDate),
        voucherCode: appliedCode || String(fd.get("voucher_code") ?? ""),
      });

      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }

      if (res.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
        return;
      }

      const params = new URLSearchParams({
        order: res.orderNumber,
        total: String(res.total),
        fulfillment,
        payment: paymentMethod,
      });
      if (res.deliveryFee > 0) params.set("delivery", String(res.deliveryFee));
      if (wantedForDate) params.set("wanted", wantedForDate);
      if (res.earnedVoucher > 0) params.set("earned", String(res.earnedVoucher));
      if (res.voucherDiscount > 0) params.set("saved", String(res.voucherDiscount));
      if (res.voucherWarning) params.set("voucherNote", res.voucherWarning);
      const successHref = `/shop/${shopSlug}/order/success?${params.toString()}`;
      setRedirecting(true);
      router.push(successHref);
      clear();
      toast.success("Order placed!");
      router.refresh();
    });
  }

  const fulfillmentLabel = fulfillment === "takeaway" ? "Collection" : "Home delivery";
  const paymentLabel = paymentMethod === "online_card" ? "Card" : "Cash on delivery";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="bg-background/80 rounded-xl border border-stone-200 p-4 dark:border-stone-800 dark:bg-stone-900/40">
        <p className="text-sm font-medium text-stone-800 dark:text-stone-200">Order summary</p>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Products</dt>
            <dd className="font-mono">{money(subtotal)}</dd>
          </div>
          {discount > 0 ? (
            <div className="flex justify-between text-emerald-800">
              <dt>Voucher</dt>
              <dd className="font-mono">−{money(discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="font-mono">
              {quote.fee === 0 ? <span className="text-primary">Free</span> : money(quote.fee)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-2 dark:border-stone-700">
            <dt className="font-semibold">Total</dt>
            <dd className="text-primary text-lg font-bold">{money(orderTotal)}</dd>
          </div>
        </dl>
        <p className="text-muted-foreground mt-2 text-xs">{quote.label}</p>
        {wholeFish ? (
          <p className="mt-2 text-xs text-amber-800">
            Whole fish is priced after we weigh it. The amount above is an estimate, and we will
            tell you the final price.
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Input
            value={voucherCode}
            onChange={(e) => {
              setVoucherCode(e.target.value.toUpperCase());
              setAppliedCode("");
              setDiscount(0);
            }}
            placeholder="Voucher code"
            className="uppercase"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              startTransition(async () => {
                const code = voucherCode.trim();
                if (!code) {
                  setDiscount(0);
                  setAppliedCode("");
                  return;
                }
                const quoted = await quoteStorefrontVoucher(shopSlug, code, subtotal);
                if (!quoted.ok) {
                  setDiscount(0);
                  setAppliedCode("");
                  setError(quoted.error);
                  return;
                }
                setError(null);
                setAppliedCode(code);
                setDiscount(quoted.discount);
              });
            }}
          >
            Apply
          </Button>
        </div>
        {fulfillment === "delivery" && deliveryAreas.length > 0 ? (
          <fieldset className="mt-3 space-y-2">
            <legend className="text-sm font-medium">Delivery area</legend>
            {deliveryAreas.map((row) => (
              <label key={row.id} className="flex cursor-pointer gap-2 text-sm">
                <input
                  type="radio"
                  name="delivery_area"
                  checked={area?.id === row.id}
                  onChange={() => setAreaId(row.id)}
                />
                <span>
                  <span className="font-medium">{row.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    Minimum €{row.minOrder.toFixed(2)} · delivery €{row.fee.toFixed(2)}
                    {row.times ? ` · ${row.times}` : ""}
                    {row.leadDays > 0 ? ` · ${row.leadDays} day lead time` : " · same day"}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}
        {belowMin && area ? (
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
            The minimum order for {area.name} is €{area.minOrder.toFixed(2)}. Add more products
            before placing the order.
          </p>
        ) : null}
      </div>

      <ol className="flex gap-2 text-xs font-medium">
        <li
          className={cn(
            "rounded-full px-3 py-1",
            step === "options"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          1. How & pay
        </li>
        <li
          className={cn(
            "rounded-full px-3 py-1",
            step === "details"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          2. Your details
        </li>
      </ol>

      {step === "options" ? (
        <>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">When do you want this order?</legend>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 text-sm transition-all",
                isAdvance
                  ? "border-primary bg-primary/15 ring-primary/40 ring-2"
                  : "hover:border-primary/40 border-stone-200",
              )}
            >
              <input
                type="checkbox"
                className="accent-primary mt-1 size-4"
                checked={isAdvance}
                onChange={(e) => {
                  if (e.target.checked) setWantedForDate(minAdvance);
                  else setWantedForDate(null);
                }}
              />
              <span>
                <span className="font-medium">Advance Order</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  At least {MIN_ADVANCE_DAYS} days in advance. We prepare for your chosen date.
                </span>
              </span>
            </label>
            {isAdvance ? (
              <div className="space-y-2">
                <Label htmlFor="wanted_for">Wanted for</Label>
                <Input
                  id="wanted_for"
                  type="date"
                  min={minAdvance}
                  value={wantedForDate ?? minAdvance}
                  onChange={(e) => setWantedForDate(e.target.value || null)}
                />
              </div>
            ) : null}
          </fieldset>

          <fieldset
            className="space-y-3"
            role="radiogroup"
            aria-label="How would you like to order?"
          >
            <legend className="text-sm font-medium">How would you like to order?</legend>
            <p className="text-muted-foreground text-xs">
              Pick one option — collection or delivery, cash or card.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <ChoiceCard
                selected={selectedMethod === "delivery_cod"}
                title="Home delivery — cash"
                description={`We bring it to you. Pay cash on arrival. €${delivery.standardFee.toFixed(2)} fee, free over €${delivery.freeOver.toFixed(0)}.`}
                icon={<Truck className="size-4" />}
                onSelect={() => selectCheckout("delivery_cod")}
              />
              {enableTakeaway ? (
                <ChoiceCard
                  selected={selectedMethod === "takeaway_cod"}
                  title="Collection — cash"
                  description="Collect in store and pay cash at the counter. No delivery fee."
                  icon={<Store className="size-4" />}
                  onSelect={() => selectCheckout("takeaway_cod")}
                />
              ) : null}
              {enableOnlinePayment ? (
                <ChoiceCard
                  selected={selectedMethod === "delivery_card"}
                  title="Home delivery — card"
                  description="We bring it to you. You pay by card on the secure Stripe page before the order is finished."
                  icon={<CreditCard className="size-4" />}
                  onSelect={() => selectCheckout("delivery_card")}
                />
              ) : null}
              {enableTakeaway && enableOnlinePayment ? (
                <ChoiceCard
                  selected={selectedMethod === "takeaway_card"}
                  title="Collection — card"
                  description="Collect in store. You pay by card on the secure Stripe page before the order is finished."
                  icon={<CreditCard className="size-4" />}
                  onSelect={() => selectCheckout("takeaway_card")}
                />
              ) : null}
            </div>
          </fieldset>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <Button
            type="button"
            size="lg"
            className="bg-primary hover:bg-primary/90 w-full"
            disabled={belowMin}
            onClick={() => {
              setError(null);
              setStep("details");
            }}
          >
            Continue — {fulfillmentLabel} · {paymentLabel}
          </Button>
        </>
      ) : (
        <>
          <div className="border-primary/30 bg-primary/10 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm">
            <p>
              <span className="font-semibold">{fulfillmentLabel}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="font-semibold">{paymentLabel}</span>
              {wantedForDate ? (
                <span className="text-muted-foreground"> · wanted {wantedForDate}</span>
              ) : null}
            </p>
            <button
              type="button"
              className="text-primary text-xs font-medium underline"
              onClick={() => setStep("options")}
            >
              Change
            </button>
          </div>

          {paymentMethod === "online_card" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              After you place this order we will confirm stock, then send a payment link by phone or
              email. Do not share card numbers with anyone claiming to be the shop.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Have cash ready when we{" "}
              {fulfillment === "takeaway" ? "hand over your order" : "arrive"}.
            </p>
          )}

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
              <Label htmlFor="email">
                Email {paymentMethod === "online_card" ? "(recommended)" : ""}
              </Label>
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
                  min={wantedForDate ? `${wantedForDate}T08:00` : minPickupLocal()}
                />
                <p className="text-muted-foreground text-xs">
                  {wantedForDate
                    ? `Choose a collection time on ${wantedForDate}.`
                    : "Choose the date and time you plan to arrive at the shop."}
                </p>
              </div>
            )}

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="voucher_code">Voucher code</Label>
              <Input
                id="voucher_code"
                name="voucher_code"
                placeholder="From your paper voucher"
                autoCapitalize="characters"
              />
              <p className="text-muted-foreground text-xs">
                The code is on the voucher you received with a previous order. It comes off the
                products only, then that code stops working.
              </p>
            </div>

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
            disabled={pending || belowMin}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {paymentMethod === "online_card"
              ? `Pay ${money(orderTotal)} by card`
              : `Place order — ${money(orderTotal)}`}
          </Button>
        </>
      )}
    </form>
  );
}
