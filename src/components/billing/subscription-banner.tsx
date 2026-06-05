import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SubscriptionAccess } from "@/lib/billing/types";

export function SubscriptionBanner({ access }: { access: SubscriptionAccess }) {
  if (!access.reason && !access.needsPayment) return null;

  const variant = access.status === "past_due" ? "destructive" : "default";

  return (
    <Alert variant={variant} className="mb-4 rounded-xl">
      <AlertTriangle className="size-4" />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{access.reason}</span>
        {(access.needsPayment || access.needsCard) && (
          <Button size="sm" variant={variant === "destructive" ? "secondary" : "default"} asChild>
            <Link href="/settings/billing">Manage billing</Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
