"use client";

import { useRouter } from "next/navigation";
import { DemoCardForm } from "@/components/billing/demo-card-form";
import type { SubscriptionAccess } from "@/lib/billing/types";
import { formatEuro } from "@/lib/utils";

export function SubscribeClient({
  shopName,
  access,
  isDemoProvider,
}: {
  shopName: string;
  access: SubscriptionAccess;
  isDemoProvider: boolean;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Start your free trial</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          <strong>{shopName}</strong> — 30 days free, then {formatEuro(access.monthlyAmountEur)}
          /month. Add a card now; you will not be charged until the trial ends.
        </p>
      </div>
      {isDemoProvider ? (
        <DemoCardForm
          submitLabel="Start free trial"
          onSuccess={() => {
            router.replace("/dashboard");
            router.refresh();
          }}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          Connect Stripe to collect cards at signup. Until then, use demo billing mode.
        </p>
      )}
    </div>
  );
}
