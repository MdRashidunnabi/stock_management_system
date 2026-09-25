"use client";

import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { DesktopAppPanel } from "@/components/desktop/desktop-app-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentCardForm } from "@/components/billing/payment-card-form";
import type { SubscriptionAccess, TenantBillingRow } from "@/lib/billing/types";
import { formatEuro } from "@/lib/utils";

interface Props {
  billing: TenantBillingRow | null;
  access: SubscriptionAccess;
}

export function OwnerBillingPanel({ billing, access }: Props) {
  const router = useRouter();
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
            {access.isTrial ? `Trial — then ${monthly}/month` : `${monthly}/month`}
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
                {billing.cardBrand ? `${billing.cardBrand} ` : "Card "}•••• {billing.cardLast4}
              </Badge>
            ) : (
              <Badge variant="destructive">No card on file</Badge>
            )}
          </div>

          {billing?.nextBillingAt ? (
            <p className="text-muted-foreground text-sm">
              Next billing: {new Date(billing.nextBillingAt).toLocaleDateString("en-IE")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {!billing?.cardOnFile ? (
        <Card>
          <CardHeader>
            <CardTitle>Payment method</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentCardForm onSuccess={() => router.refresh()} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Desktop POS app</CardTitle>
        </CardHeader>
        <CardContent>
          <DesktopAppPanel />
        </CardContent>
      </Card>
    </div>
  );
}
