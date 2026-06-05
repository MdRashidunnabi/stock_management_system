import type { Metadata } from "next";
import { OwnerBillingPanel } from "@/components/billing/owner-billing-panel";
import { requireRole } from "@/lib/auth/tenant";
import { getBillingAccountForTenant } from "@/lib/billing/account-queries";
import { formatPlanSummary } from "@/lib/billing/plans";
import { getTenantBilling, getTenantSubscriptionAccess } from "@/lib/billing/queries";
import { getBillingProvider } from "@/lib/billing/provider";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingSettingsPage() {
  const tenant = await requireRole(["owner"]);
  const [billing, access, account] = await Promise.all([
    getTenantBilling(tenant.tenantId),
    getTenantSubscriptionAccess(tenant.tenantId),
    getBillingAccountForTenant(tenant.tenantId),
  ]);
  const planSummary = account && formatPlanSummary(account.planShopTier, account.planBranchTier);
  const provider = getBillingProvider();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & subscription</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your ShopOS plan for {tenant.tenantName}.
          {planSummary ? (
            <>
              <br />
              {planSummary}
            </>
          ) : null}
        </p>
      </div>
      {access ? (
        <OwnerBillingPanel
          billing={billing}
          access={access}
          isDemoProvider={provider.name === "demo"}
        />
      ) : null}
    </div>
  );
}
