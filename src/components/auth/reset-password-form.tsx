"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/auth/schemas";
import { updatePasswordAction } from "@/lib/auth/actions";
import { useT } from "@/components/i18n/locale-provider";
import { displayMessage } from "@/lib/i18n/display";

export function ResetPasswordForm() {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  function onSubmit(values: ResetPasswordInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await updatePasswordAction(values);
      if (res?.serverError) {
        setServerError(displayMessage(t, res.serverError));
        return;
      }
      const data = res?.data;
      if (data && data.ok === false) {
        setServerError(displayMessage(t, data.message));
        return;
      }
      if (data && data.ok === true) {
        toast.success(t("auth.passwordUpdated"));
        router.push("/dashboard");
      }
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
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          disabled={pending}
          aria-invalid={Boolean(form.formState.errors.password) || undefined}
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-destructive text-xs">
            {displayMessage(t, form.formState.errors.password.message)}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">{t("auth.passwordHint")}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          disabled={pending}
          aria-invalid={Boolean(form.formState.errors.confirmPassword) || undefined}
          {...form.register("confirmPassword")}
        />
        {form.formState.errors.confirmPassword ? (
          <p className="text-destructive text-xs">
            {displayMessage(t, form.formState.errors.confirmPassword.message)}
          </p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : t("common.save")}
      </Button>
    </form>
  );
}
