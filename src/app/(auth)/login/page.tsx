import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getRequestLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const m = getMessages(locale);
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{m.auth.signInTitle}</h1>
        <p className="text-muted-foreground text-sm">{m.auth.signInSub}</p>
      </div>
      <SignInForm next={sp.next} initialError={sp.error} />
    </div>
  );
}
