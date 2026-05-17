import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUser } from "@/lib/auth/tenant";

export const metadata: Metadata = {
  title: "Set a new password",
  description: "Set a new password for your ShopOS account.",
};

/**
 * /reset-password is reached AFTER /auth/callback exchanged the recovery code
 * for a session, so the user is "signed in" with a regular session and can
 * call `auth.updateUser({ password })`. If they hit this page without a
 * session, send them back to /forgot-password.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/forgot-password");

  return (
    <AuthShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
          <p className="text-muted-foreground text-sm">
            Choose a new password for <span className="font-medium">{user.email}</span>.
          </p>
        </div>
        <ResetPasswordForm />
        <p className="text-muted-foreground text-center text-xs">
          Didn&apos;t mean to reset?{" "}
          <Link href="/dashboard" className="text-foreground underline-offset-2 hover:underline">
            Back to dashboard
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
