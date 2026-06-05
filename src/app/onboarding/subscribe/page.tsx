import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SubscribeClient } from "@/components/billing/subscribe-client";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getTenantBilling, getTenantSubscriptionAccess } from "@/lib/billing/queries";
import { getBillingProvider } from "@/lib/billing/provider";
import { requireRole, requireTenant } from "@/lib/auth/tenant";

export const metadata: Metadata = { title: "Start your trial" };

export default async function OnboardingSubscribePage() {
  const tenant = await requireRole(["owner"]);
  const billing = await getTenantBilling(tenant.tenantId);
  const access = await getTenantSubscriptionAccess(tenant.tenantId);

  if (billing?.cardOnFile && access?.canUseApp) {
    redirect("/dashboard");
  }

  const provider = getBillingProvider();

  return (
    <div className="bg-background min-h-dvh">
      <header className="border-border flex h-14 items-center justify-between border-b px-4 sm:px-6">
        <span className="text-sm font-semibold">ShopOS</span>
        <SignOutButton />
      </header>
      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <SubscribeClient
          shopName={tenant.tenantName}
          access={access!}
          isDemoProvider={provider.name === "demo"}
        />
      </main>
    </div>
  );
}
