"use client";

import { useState, useTransition } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AcceptedCardBrands, CardBrandMark } from "@/components/billing/card-brand-marks";
import { attachDemoCardAction } from "@/lib/billing/actions";
import {
  CARD_BRAND_LABELS,
  cvcLengthForBrand,
  detectCardBrand,
  digitsOnly,
  formatCardNumber,
  formatCardholderName,
  formatExpiryInput,
  parseExpiry,
} from "@/lib/billing/card";
import { paymentCardSchema } from "@/lib/billing/schemas";
import { cn } from "@/lib/utils";

interface Props {
  onSuccess?: () => void;
  submitLabel?: string;
}

type Field = "cardholderName" | "cardNumber" | "expiry" | "cvc";

export function PaymentCardForm({ onSuccess, submitLabel = "Save payment method" }: Props) {
  const [pending, startTransition] = useTransition();
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field | "form", string>>>({});

  const brand = detectCardBrand(cardNumber);
  const cvcLen = cvcLengthForBrand(brand);
  const panDigits = digitsOnly(cardNumber);
  const displayPan = panDigits
    ? formatCardNumber(cardNumber)
    : brand === "amex"
      ? "•••• •••••• •••••"
      : "•••• •••• •••• ••••";

  function validateAndPayload() {
    const parsed = parseExpiry(expiry);
    const result = paymentCardSchema.safeParse({
      cardholderName,
      cardNumber,
      expiryMonth: parsed?.month ?? "",
      expiryYear: parsed?.year ?? "",
      cvc,
    });
    if (!result.success) {
      const next: Partial<Record<Field | "form", string>> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (key === "expiryMonth" || key === "expiryYear") next.expiry = issue.message;
        else if (key === "cardholderName" || key === "cardNumber" || key === "cvc") {
          next[key] = issue.message;
        } else next.form = issue.message;
      }
      setErrors(next);
      return null;
    }
    setErrors({});
    return result.data;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    const payload = validateAndPayload();
    if (!payload) return;
    startTransition(async () => {
      const res = await attachDemoCardAction(payload);
      if (res?.serverError) {
        setErrors({ form: res.serverError });
        toast.error(res.serverError);
        return;
      }
      if (res?.validationErrors) {
        setErrors({ form: "Check the card details and try again." });
        return;
      }
      toast.success("Payment method saved.");
      onSuccess?.();
    });
  }

  return (
    <form
      method="post"
      action="#"
      onSubmit={onSubmit}
      className="space-y-5"
      autoComplete="on"
      noValidate
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-emerald-950 p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -top-10 -right-8 size-32 rounded-full bg-emerald-400/20 blur-2xl" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.18em] text-white/60 uppercase">
              Payment card
            </p>
            <p className="mt-5 font-mono text-lg tracking-[0.18em] sm:text-xl">{displayPan}</p>
          </div>
          {brand ? (
            <CardBrandMark brand={brand} className="h-8 w-12 shadow-md" />
          ) : (
            <div className="h-8 w-12 rounded-md border border-white/20 bg-white/10" />
          )}
        </div>
        <div className="mt-6 flex items-end justify-between gap-3 text-xs">
          <div>
            <p className="text-white/50">Cardholder</p>
            <p className="mt-0.5 text-sm font-medium tracking-wide uppercase">
              {cardholderName.trim() || "YOUR NAME"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-white/50">Expires</p>
            <p className="mt-0.5 font-mono text-sm">{expiry.trim() || "MM / YY"}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">We accept</p>
        <AcceptedCardBrands active={brand} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cardholderName">Name on card</Label>
        <Input
          id="cardholderName"
          name="cardholderName"
          autoComplete="cc-name"
          value={cardholderName}
          onChange={(e) => setCardholderName(formatCardholderName(e.target.value))}
          placeholder="Name as it appears on the card"
          aria-invalid={Boolean(errors.cardholderName) || undefined}
        />
        {errors.cardholderName ? (
          <p className="text-destructive text-xs">{errors.cardholderName}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="cardNumber">Card number</Label>
        <div className="relative">
          <Input
            id="cardNumber"
            name="cardNumber"
            inputMode="numeric"
            autoComplete="cc-number"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            placeholder="Card number"
            className="pr-14"
            aria-invalid={Boolean(errors.cardNumber) || undefined}
          />
          {brand ? (
            <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
              <CardBrandMark brand={brand} className="h-6 w-9" />
            </span>
          ) : null}
        </div>
        {errors.cardNumber ? (
          <p className="text-destructive text-xs">{errors.cardNumber}</p>
        ) : brand ? (
          <p className="text-muted-foreground text-xs">{CARD_BRAND_LABELS[brand]}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="expiry">Expiry</Label>
          <Input
            id="expiry"
            name="expiry"
            inputMode="numeric"
            autoComplete="cc-exp"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiryInput(e.target.value))}
            placeholder="MM / YY"
            aria-invalid={Boolean(errors.expiry) || undefined}
          />
          {errors.expiry ? <p className="text-destructive text-xs">{errors.expiry}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cvc">{brand === "amex" ? "CID" : "CVC"}</Label>
          <Input
            id="cvc"
            name="cvc"
            inputMode="numeric"
            autoComplete="cc-csc"
            value={cvc}
            maxLength={cvcLen}
            onChange={(e) => setCvc(digitsOnly(e.target.value).slice(0, cvcLen))}
            placeholder={brand === "amex" ? "4 digits" : "3 digits"}
            aria-invalid={Boolean(errors.cvc) || undefined}
          />
          {errors.cvc ? <p className="text-destructive text-xs">{errors.cvc}</p> : null}
        </div>
      </div>

      {errors.form ? <p className="text-destructive text-sm">{errors.form}</p> : null}

      <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
        {submitLabel}
      </Button>

      <p className={cn("text-muted-foreground flex items-start gap-2 text-xs leading-relaxed")}>
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        Your card is encrypted. You will not be charged until the 30-day trial ends. Cancel any time
        before then.
      </p>
    </form>
  );
}
