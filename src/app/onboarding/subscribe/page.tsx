import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SubscribeClient } from "@/components/billing/subscribe-client";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getTenantSubscriptionAccess } from "@/lib/billing/queries";
import { requireRole } from "@/lib/auth/tenant";

export const metadata: Metadata = { title: "Payment method" };

export default async function OnboardingSubscribePage() {
  const tenant = await requireRole(["owner"]);
  const access = await getTenantSubscriptionAccess(tenant.tenantId);

  if (access && !access.needsCard && access.canUseApp) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-background min-h-dvh">
      <header className="border-border bg-card/80 flex h-14 items-center justify-between border-b px-4 backdrop-blur sm:px-6">
        <span className="text-sm font-semibold tracking-tight">ShopOS</span>
        <SignOutButton />
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
        <SubscribeClient shopName={tenant.tenantName} access={access!} />
      </main>
    </div>
  );
}
