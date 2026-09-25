import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getRequestLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export const metadata: Metadata = {
  title: "Reset password",
};

export default async function ForgotPasswordPage() {
  const locale = await getRequestLocale();
  const m = getMessages(locale);
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{m.auth.resetTitle}</h1>
        <p className="text-muted-foreground text-sm">{m.auth.resetSub}</p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
