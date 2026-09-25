"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signInSchema, type SignInInput } from "@/lib/auth/schemas";
import { signInAction } from "@/lib/auth/actions";
import { useT } from "@/components/i18n/locale-provider";
import { displayMessage } from "@/lib/i18n/display";

interface Props {
  next?: string;
  initialError?: string;
}

export function SignInForm({ next, initialError }: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(
    initialError ? displayMessage(t, initialError) : null,
  );

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
      next: next ?? "/dashboard",
    },
  });

  function onSubmit(values: SignInInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await signInAction(values);
      if (res?.serverError) {
        setServerError(displayMessage(t, res.serverError));
        return;
      }
      if (res?.validationErrors) {
        setServerError(t("auth.formCheck"));
        return;
      }
      if (res?.data && res.data.ok === false) {
        setServerError(displayMessage(t, res.data.message));
        return;
      }
      // success - the action redirected
      toast.success(t("auth.signedIn"));
    });
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
          >
            {t("auth.forgot")}
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          disabled={pending}
          aria-invalid={Boolean(form.formState.errors.password) || undefined}
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-destructive text-xs">
            {displayMessage(t, form.formState.errors.password.message)}
          </p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : t("common.signIn")}
      </Button>

      <Button asChild variant="outline" className="w-full">
        <Link href="/signup">{t("common.createAccount")}</Link>
      </Button>
    </form>
  );
}
