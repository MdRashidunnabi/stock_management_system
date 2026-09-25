"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { signUpSchema, type SignUpInput } from "@/lib/auth/schemas";
import { signUpAction } from "@/lib/auth/actions";
import { useT } from "@/components/i18n/locale-provider";
import { displayMessage } from "@/lib/i18n/display";
import { CountrySelect } from "@/components/geo/country-select";
import { isCountryCode } from "@/lib/geo/countries";

interface Props {
  next?: string;
}

export function SignUpForm({ next }: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      country: "",
      marketingOptIn: false,
    },
  });

  function onSubmit(values: SignUpInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await signUpAction(values);
      if (res?.serverError) {
        setServerError(displayMessage(t, res.serverError));
        return;
      }
      if (res?.validationErrors) {
        setServerError(t("auth.formCheck"));
        return;
      }
      const data = res?.data;
      if (data && data.ok === false) {
        setServerError(displayMessage(t, data.message));
        return;
      }
      if (data && data.ok === true) {
        if (data.requiresEmailConfirmation) {
          toast.success(t("auth.created"));
          const u = `/verify-email?email=${encodeURIComponent(data.email)}`;
          router.push(u);
        } else {
          toast.success(t("auth.welcome"));
          const target =
            next && next.startsWith("/") && !next.startsWith("//") ? next : "/onboarding";
          router.push(target);
        }
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
        <Label htmlFor="fullName">{t("auth.name")}</Label>
        <Input
          id="fullName"
          autoComplete="name"
          autoFocus
          disabled={pending}
          aria-invalid={Boolean(form.formState.errors.fullName) || undefined}
          {...form.register("fullName")}
        />
        {form.formState.errors.fullName ? (
          <p className="text-destructive text-xs">
            {displayMessage(t, form.formState.errors.fullName.message)}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
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
        <Label htmlFor="country">{t("auth.country")}</Label>
        <Controller
          control={form.control}
          name="country"
          render={({ field }) => (
            <CountrySelect
              id="country"
              value={field.value}
              disabled={pending}
              invalid={Boolean(form.formState.errors.country)}
              onChange={(code) => field.onChange(isCountryCode(code) ? code : "")}
            />
          )}
        />
        {form.formState.errors.country ? (
          <p className="text-destructive text-xs">
            {displayMessage(t, form.formState.errors.country.message)}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">{t("auth.countryHint")}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
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

      <div className="flex items-start gap-2">
        <Controller
          control={form.control}
          name="marketingOptIn"
          render={({ field }) => (
            <Checkbox
              id="marketingOptIn"
              checked={field.value ?? false}
              onCheckedChange={(v) => field.onChange(v === true)}
              disabled={pending}
            />
          )}
        />
        <Label htmlFor="marketingOptIn" className="text-muted-foreground text-xs leading-relaxed">
          {t("auth.marketing")}
        </Label>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : t("auth.create")}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        {t("auth.hasAccount")}{" "}
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
