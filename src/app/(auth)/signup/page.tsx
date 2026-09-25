import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getRequestLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export const metadata: Metadata = {
  title: "Create account",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const isInvite = sp.next?.startsWith("/invite/");
  const locale = await getRequestLocale();
  const m = getMessages(locale);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isInvite ? m.auth.signUpInviteTitle : m.auth.signUpTitle}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isInvite ? m.auth.signUpInviteSub : m.auth.signUpSub}
        </p>
      </div>
      <SignUpForm next={sp.next} />
    </div>
  );
}
