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

export function SignUpForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      marketingOptIn: false,
    },
  });

  function onSubmit(values: SignUpInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await signUpAction(values);
      if (res?.serverError) {
        setServerError(res.serverError);
        return;
      }
      if (res?.validationErrors) {
        setServerError("Please check the form for errors.");
        return;
      }
      const data = res?.data;
      if (data && data.ok === false) {
        setServerError(data.message);
        return;
      }
      if (data && data.ok === true) {
        if (data.requiresEmailConfirmation) {
          toast.success("Account created. Confirm your email to continue.");
          const u = `/verify-email?email=${encodeURIComponent(data.email)}`;
          router.push(u);
        } else {
          toast.success("Welcome to ShopOS!");
          router.push("/dashboard");
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
        <Label htmlFor="fullName">Your name</Label>
        <Input
          id="fullName"
          autoComplete="name"
          autoFocus
          disabled={pending}
          aria-invalid={Boolean(form.formState.errors.fullName) || undefined}
          {...form.register("fullName")}
        />
        {form.formState.errors.fullName ? (
          <p className="text-destructive text-xs">{form.formState.errors.fullName.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          disabled={pending}
          aria-invalid={Boolean(form.formState.errors.email) || undefined}
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          disabled={pending}
          aria-invalid={Boolean(form.formState.errors.password) || undefined}
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-destructive text-xs">{form.formState.errors.password.message}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            At least 8 characters, including a letter and a number.
          </p>
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
          Send me product updates and Irish retail tips. You can unsubscribe at any time.
        </Label>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-foreground font-medium underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
