"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { attachDemoCardAction } from "@/lib/billing/actions";

interface Props {
  onSuccess?: () => void;
  submitLabel?: string;
}

export function DemoCardForm({ onSuccess, submitLabel = "Save card & continue" }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await attachDemoCardAction({
        cardholderName: String(fd.get("cardholderName") ?? ""),
        cardNumber: String(fd.get("cardNumber") ?? ""),
        expiryMonth: String(fd.get("expiryMonth") ?? ""),
        expiryYear: String(fd.get("expiryYear") ?? ""),
        cvc: String(fd.get("cvc") ?? ""),
      });
      if (res?.serverError) {
        setError(res.serverError);
        toast.error(res.serverError);
        return;
      }
      toast.success("Card saved (demo mode)");
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Demo mode: use test card <span className="font-mono">4242 4242 4242 4242</span>. When you
        connect Stripe, this form is replaced by secure Stripe Checkout.
      </p>
      <div className="space-y-2">
        <Label htmlFor="cardholderName">Name on card</Label>
        <Input id="cardholderName" name="cardholderName" required placeholder="Shop owner name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cardNumber">Card number</Label>
        <Input
          id="cardNumber"
          name="cardNumber"
          required
          placeholder="4242 4242 4242 4242"
          autoComplete="cc-number"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="expiryMonth">MM</Label>
          <Input id="expiryMonth" name="expiryMonth" required placeholder="12" maxLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiryYear">YY</Label>
          <Input id="expiryYear" name="expiryYear" required placeholder="28" maxLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cvc">CVC</Label>
          <Input id="cvc" name="cvc" required placeholder="123" maxLength={4} />
        </div>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}
