import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getCurrentTenant, requireUser } from "@/lib/auth/tenant";

export const metadata: Metadata = {
  title: "Set up your shop",
};

/**
 * Onboarding wizard. Reached when a signed-in user has no active tenant
 * (e.g. just signed up and hasn't created a shop yet). If they already have
 * a tenant, send them to the dashboard.
 */
export default async function OnboardingPage() {
  const user = await requireUser();
  const tenant = await getCurrentTenant();
  if (tenant) redirect("/dashboard");

  return (
    <div className="bg-background min-h-dvh">
      <header className="border-border bg-card/40 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur sm:px-6">
        <div className="text-muted-foreground text-xs">ShopOS - Ireland</div>
        <SignOutButton />
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:py-12">
        <OnboardingWizard
          ownerEmail={user.email ?? "you"}
          ownerName={(user.user_metadata?.full_name as string | undefined) ?? null}
        />
      </main>
    </div>
  );
}
