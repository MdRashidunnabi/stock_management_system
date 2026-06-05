"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { DesktopAppPanel } from "@/components/desktop/desktop-app-panel";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoCardForm } from "@/components/billing/demo-card-form";
import { activateSubscriptionAction, simulateOwnerPaymentAction } from "@/lib/billing/actions";
import type { SubscriptionAccess, TenantBillingRow } from "@/lib/billing/types";
import { formatEuro } from "@/lib/utils";

interface Props {
  billing: TenantBillingRow | null;
  access: SubscriptionAccess;
  isDemoProvider: boolean;
}

export function OwnerBillingPanel({ billing, access, isDemoProvider }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ data?: { ok: boolean }; serverError?: string }>) {
    startTransition(async () => {
      const res = await action();
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success("Updated");
      router.refresh();
    });
  }

  const monthly = formatEuro(access.monthlyAmountEur);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5" />
            Subscription
          </CardTitle>
          <CardDescription>
            {access.isTrial
              ? `Free trial — then ${monthly}/month. Cancel anytime before you are charged.`
              : `ShopOS Standard — ${monthly}/month.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="capitalize">
              Status: {access.status.replace("_", " ")}
            </Badge>
            {access.daysLeftInTrial != null ? (
              <Badge variant="secondary">{access.daysLeftInTrial} days left in trial</Badge>
            ) : null}
            {billing?.cardOnFile ? (
              <Badge variant="secondary">
                Card •••• {billing.cardLast4} ({billing.cardBrand})
              </Badge>
            ) : (
              <Badge variant="destructive">No card on file</Badge>
            )}
            <Badge variant="outline">{isDemoProvider ? "Demo billing" : "Stripe"}</Badge>
          </div>

          {billing?.nextBillingAt ? (
            <p className="text-muted-foreground text-sm">
              Next billing: {new Date(billing.nextBillingAt).toLocaleDateString("en-IE")}
            </p>
          ) : null}

          {isDemoProvider && access.needsPayment && billing?.cardOnFile ? (
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending} onClick={() => run(() => activateSubscriptionAction())}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Activate subscription (demo)
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => run(() => simulateOwnerPaymentAction())}
              >
                Simulate monthly payment
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isDemoProvider && !billing?.cardOnFile ? (
        <Card>
          <CardHeader>
            <CardTitle>Payment method</CardTitle>
            <CardDescription>
              Required to start your trial. No charge until trial ends.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DemoCardForm onSuccess={() => router.refresh()} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Desktop POS app</CardTitle>
          <CardDescription>
            Windows installer or browser install for tills and barcode scanners. Same login as the
            web app; subscription is checked each session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DesktopAppPanel />
        </CardContent>
      </Card>
    </div>
  );
}
