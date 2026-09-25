"use client";

import { useRouter } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";
import { PaymentCardForm } from "@/components/billing/payment-card-form";
import type { SubscriptionAccess } from "@/lib/billing/types";
import { formatEuro } from "@/lib/utils";

export function SubscribeClient({
  shopName,
  access,
}: {
  shopName: string;
  access: SubscriptionAccess;
}) {
  const router = useRouter();
  const monthly = formatEuro(access.monthlyAmountEur);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)] lg:items-start">
      <aside className="space-y-5">
        <div>
          <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
            Secure checkout
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Start your free trial
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Add a payment method for <span className="text-foreground font-medium">{shopName}</span>
            . 30 days free, then {monthly}/month. You will not be charged today.
          </p>
        </div>

        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <p className="text-sm font-medium">Your plan</p>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground text-sm">30-day trial</span>
            <span className="text-sm font-semibold">€0.00 due today</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground text-sm">Then billed monthly</span>
            <span className="text-sm font-semibold">{monthly}</span>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              "Shops, branches, till, and stock included",
              "Cancel before the trial ends — no charge",
              "Card is authorised, not billed today",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ShieldCheck className="size-4" />
          256-bit encryption · Visa, Mastercard, American Express, Discover
        </p>
      </aside>

      <div className="bg-card rounded-xl border p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold">Payment method</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Enter a valid card. The brand is detected as you type.
          </p>
        </div>
        <PaymentCardForm
          submitLabel="Start free trial"
          onSuccess={() => {
            router.replace("/dashboard");
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
