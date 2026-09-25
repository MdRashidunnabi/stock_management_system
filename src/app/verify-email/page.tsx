import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { env } from "@/lib/env";
import { getRequestLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export const metadata: Metadata = {
  title: "Confirm email",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const sp = await searchParams;
  const email = sp.email;
  const locale = await getRequestLocale();
  const m = getMessages(locale);
  const showMailpit = env.NEXT_PUBLIC_APP_ENV === "development";

  return (
    <AuthShell>
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="bg-primary/10 text-primary mb-4 flex size-12 items-center justify-center rounded-full">
            <Mail className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{m.auth.checkEmail}</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {m.auth.checkEmailSub.replace("{email}", email ?? "")}
          </p>
        </div>

        {showMailpit ? (
          <Alert>
            <AlertDescription className="text-xs">
              Dev: Mailpit{" "}
              <Link
                href="http://127.0.0.1:54324"
                className="underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                127.0.0.1:54324
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}

        <p className="text-muted-foreground text-center text-xs">
          {m.auth.alreadyConfirmed}{" "}
          <Link href="/login" className="text-foreground underline-offset-2 hover:underline">
            {m.common.signIn}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
