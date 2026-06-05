import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTenantSubscriptionAccess } from "@/lib/billing/queries";
import { requireTenant } from "@/lib/auth/tenant";

export const metadata = { title: "Subscription required" };

export default async function BillingLockedPage() {
  const tenant = await requireTenant();
  const access = await getTenantSubscriptionAccess(tenant.tenantId);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 py-16 text-center">
      <div className="bg-muted flex size-16 items-center justify-center rounded-full">
        <Lock className="text-muted-foreground size-8" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Access paused</h1>
        <p className="text-muted-foreground text-sm">
          {access?.reason ?? "Your shop subscription is not active."}
        </p>
      </div>
      {tenant.role === "owner" ? (
        <Button asChild>
          <Link href="/settings/billing">Manage billing</Link>
        </Button>
      ) : (
        <p className="text-muted-foreground text-xs">
          Contact your shop owner ({tenant.tenantName}) to renew the subscription.
        </p>
      )}
    </div>
  );
}
