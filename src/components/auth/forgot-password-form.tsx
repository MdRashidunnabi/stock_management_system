"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/auth/schemas";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { useT } from "@/components/i18n/locale-provider";
import { displayMessage } from "@/lib/i18n/display";

export function ForgotPasswordForm() {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: ForgotPasswordInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await requestPasswordResetAction(values);
      if (res?.serverError) {
        setServerError(displayMessage(t, res.serverError));
        return;
      }
      if (res?.data?.ok) {
        setSent(res.data.email);
      }
    });
  }

  if (sent) {
    return (
      <Alert>
        <AlertDescription>{t("auth.resetSent")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError ? (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          disabled={pending}
          aria-invalid={Boolean(form.formState.errors.email) || undefined}
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-destructive text-xs">
            {displayMessage(t, form.formState.errors.email.message)}
          </p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : t("auth.sendLink")}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        {t("auth.remembered")}{" "}
        <Link
          href="/login"
          className="text-foreground font-medium underline-offset-2 hover:underline"
        >
          {t("common.signIn")}
        </Link>
      </p>
    </form>
  );
}
