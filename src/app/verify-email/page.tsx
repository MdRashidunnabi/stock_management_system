import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Confirm your email",
  description: "Check your inbox to confirm your ShopOS account.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const sp = await searchParams;
  const email = sp.email;
  return (
    <AuthShell>
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="bg-primary/10 text-primary mb-4 flex size-12 items-center justify-center rounded-full">
            <Mail className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            We&apos;ve sent a confirmation link to{" "}
            {email ? <span className="text-foreground font-medium">{email}</span> : "your inbox"}.
            Click it to finish setting up your account.
          </p>
        </div>

        <Alert>
          <AlertDescription className="text-xs">
            Local development tip: emails are delivered to the Mailpit inbox at{" "}
            <Link
              href="http://127.0.0.1:54324"
              className="text-foreground underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              http://127.0.0.1:54324
            </Link>
            .
          </AlertDescription>
        </Alert>

        <p className="text-muted-foreground text-center text-xs">
          Already confirmed?{" "}
          <Link href="/login" className="text-foreground underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
