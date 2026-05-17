import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getCurrentTenant, requireUser } from "@/lib/auth/tenant";

export const metadata: Metadata = {
  title: "Set up your shop",
};

/**
 * Onboarding placeholder. Step 6 will turn this into a real wizard
 * (create shop, first branch, first user, IVA defaults, currency).
 *
 * For now: if the signed-in user already has a tenant, send them to the
 * dashboard. Otherwise show a friendly "we're not done yet" message so they
 * don't hit a redirect loop.
 */
export default async function OnboardingPage() {
  const user = await requireUser();
  const tenant = await getCurrentTenant();
  if (tenant) redirect("/dashboard");

  return (
    <AuthShell>
      <div className="space-y-6 text-center">
        <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full">
          <Sparkles className="size-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">You&apos;re almost there</h1>
          <p className="text-muted-foreground text-sm">
            You&apos;re signed in as{" "}
            <span className="text-foreground font-medium">{user.email}</span> but you don&apos;t
            belong to any shop yet. The tenant onboarding wizard ships in Step 6 - until then, ask
            an existing owner to invite you, or sign out and pick a different account.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="text-foreground text-sm underline-offset-2 hover:underline">
            Back to home
          </Link>
          <SignOutButton />
        </div>
      </div>
    </AuthShell>
  );
}
