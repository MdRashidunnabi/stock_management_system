import type { Metadata } from "next";
import { OwnerBillingPanel } from "@/components/billing/owner-billing-panel";
import { requireRole } from "@/lib/auth/tenant";
import { getTenantBilling, getTenantSubscriptionAccess } from "@/lib/billing/queries";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingSettingsPage() {
  const tenant = await requireRole(["owner"]);
  const [billing, access] = await Promise.all([
    getTenantBilling(tenant.tenantId),
    getTenantSubscriptionAccess(tenant.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" data-guide="billing">
        Billing
      </h1>
      {access ? <OwnerBillingPanel billing={billing} access={access} /> : null}
    </div>
  );
}
