"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type UseFormRegisterReturn, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Store, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  branchStepSchema,
  createTenantSchema,
  planStepSchema,
  shopStepSchema,
  monthlyCentsFromPlanInput,
} from "@/lib/onboarding/schemas";
import { BRANCH_PLAN_OPTIONS, PLAN_OPTIONS, formatPlanSummary } from "@/lib/billing/plans";

/**
 * The Zod schema uses .transform() (e.g. vatNumber/eircode/branchCode are
 * uppercased) so the input shape (what the user types into the form) and the
 * output shape (what handleSubmit + the server action receive) differ. We
 * thread both through useForm with the 3-param signature so types align.
 */
type FormIn = z.input<typeof createTenantSchema>;
type FormOut = z.output<typeof createTenantSchema>;
import { createTenantAction } from "@/lib/onboarding/actions";
import { slugify } from "@/lib/utils";
import { DEFAULT_CURRENCY, DEFAULT_LOCALE, DEFAULT_TIMEZONE } from "@/lib/constants";

type Step = 1 | 2 | 3 | 4;

const STEPS: { id: Step; title: string; subtitle: string; icon: React.ReactNode }[] = [
  {
    id: 1,
    title: "Your plan",
    subtitle: "How many shops & branches",
    icon: <Sparkles className="size-4" />,
  },
  {
    id: 2,
    title: "Your shop",
    subtitle: "Name and website address",
    icon: <Store className="size-4" />,
  },
  {
    id: 3,
    title: "First branch",
    subtitle: "Your main location",
    icon: <MapPin className="size-4" />,
  },
  { id: 4, title: "Review", subtitle: "Confirm and create", icon: <Check className="size-4" /> },
];

interface Props {
  ownerEmail: string;
  ownerName?: string | null;
}

export function OnboardingWizard({ ownerEmail, ownerName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = useState(false);

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(createTenantSchema),
    mode: "onTouched",
    defaultValues: {
      legalName: "",
      displayName: "",
      slug: "",
      vatNumber: "",
      branchCode: "MAIN",
      branchName: "",
      branchAddressLine1: "",
      branchCity: "",
      branchCounty: "",
      branchEircode: "",
      planShopTier: 1,
      planBranchTier: 1,
    },
  });

  const planShopTier = useWatch({ control: form.control, name: "planShopTier" }) ?? 1;
  const planBranchTier = useWatch({ control: form.control, name: "planBranchTier" }) ?? 1;
  const planSummary = formatPlanSummary(
    planShopTier as 1 | 5 | 10 | 15 | 20 | 25 | 30,
    planBranchTier as 1 | 5 | 10 | 15 | 20 | 25 | 30,
  );

  const watchedDisplayName = useWatch({ control: form.control, name: "displayName" });
  const watchedBranchName = useWatch({ control: form.control, name: "branchName" });

  // Auto-derive slug from displayName until the user types in the slug field.
  useEffect(() => {
    if (slugTouched) return;
    const next = slugify(watchedDisplayName ?? "");
    form.setValue("slug", next, { shouldValidate: false });
  }, [watchedDisplayName, slugTouched, form]);

  // Auto-fill branchName the first time we hit step 3 if it's still empty.
  useEffect(() => {
    if (step === 3 && !watchedBranchName) {
      form.setValue("branchName", form.getValues("displayName"), {
        shouldValidate: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function goNext() {
    setServerError(null);
    const fields =
      step === 1
        ? (Object.keys(planStepSchema.shape) as (keyof FormIn)[])
        : step === 2
          ? (Object.keys(shopStepSchema.shape) as (keyof FormIn)[])
          : (Object.keys(branchStepSchema.shape) as (keyof FormIn)[]);
    const ok = await form.trigger(fields);
    if (!ok) return;
    setStep((s) => (s === 4 ? 4 : ((s + 1) as Step)));
  }

  function goBack() {
    setServerError(null);
    setStep((s) => (s === 1 ? 1 : ((s - 1) as Step)));
  }

  function onFinalSubmit(values: FormOut) {
    setServerError(null);
    startTransition(async () => {
      const res = await createTenantAction(values);
      if (res?.serverError) {
        setServerError(res.serverError);
        toast.error(res.serverError);
        return;
      }
      if (res?.validationErrors) {
        setServerError("Please review the form for errors.");
        return;
      }
      const data = res?.data;
      if (data?.ok) {
        toast.success("Shop created — add your card to start your free trial.");
        router.replace("/onboarding/subscribe");
        router.refresh();
      }
    });
  }

  const currentStepMeta = STEPS.find((s) => s.id === step)!;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
          Step 6 - Tenant onboarding
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Set up your shop on ShopOS
        </h1>
        <p className="text-muted-foreground text-sm">
          Signed in as{" "}
          <span className="text-foreground font-medium">{ownerName ?? ownerEmail}</span>. Pick how
          many shops and branches you need — you can invite cashiers and managers for each location
          later.
        </p>
      </div>

      <ol className="flex items-stretch gap-2">
        {STEPS.map((s, idx) => {
          const isDone = step > s.id;
          const isCurrent = step === s.id;
          return (
            <li key={s.id} className="flex flex-1 items-center gap-2">
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                  isDone
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="size-4" /> : s.id}
              </div>
              <div className="hidden flex-col leading-tight sm:flex">
                <span
                  className={
                    isCurrent
                      ? "text-foreground text-sm font-medium"
                      : "text-muted-foreground text-sm"
                  }
                >
                  {s.title}
                </span>
                <span className="text-muted-foreground text-xs">{s.subtitle}</span>
              </div>
              {idx < STEPS.length - 1 ? <div className="bg-border mx-1 h-px flex-1" /> : null}
            </li>
          );
        })}
      </ol>

      <form onSubmit={form.handleSubmit(onFinalSubmit)} noValidate>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="text-muted-foreground">{currentStepMeta.icon}</div>
              <CardTitle className="text-lg">{currentStepMeta.title}</CardTitle>
            </div>
            <CardDescription>{currentStepMeta.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {serverError ? (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}

            {step === 1 ? <PlanStep form={form} summary={planSummary} /> : null}
            {step === 2 ? (
              <ShopStep form={form} onSlugTouched={() => setSlugTouched(true)} />
            ) : null}
            {step === 3 ? <BranchStep form={form} /> : null}
            {step === 4 ? (
              <ReviewStep
                values={form.getValues()}
                monthlyCents={monthlyCentsFromPlanInput({
                  planShopTier: planShopTier as 1,
                  planBranchTier: planBranchTier as 1,
                })}
              />
            ) : null}
          </CardContent>
        </Card>

        <div className="mt-5 flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={goBack} disabled={pending || step === 1}>
            <ArrowLeft className="size-4" /> Back
          </Button>

          {step < 4 ? (
            <Button type="button" onClick={goNext} disabled={pending}>
              Continue <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Creating
                </>
              ) : (
                <>
                  Create my shop <Sparkles className="size-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

/* ----------------------- step 1: plan ----------------------------- */

function PlanStep({
  form,
  summary,
}: {
  form: UseFormReturn<FormIn, unknown, FormOut>;
  summary: string;
}) {
  const shopTier = useWatch({ control: form.control, name: "planShopTier" });
  const branchTier = useWatch({ control: form.control, name: "planBranchTier" });

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Choose the size that fits you today. More shops cost less per shop. You can add staff with
        their own login for each branch.
      </p>

      <div className="space-y-3">
        <Label>How many shops will you run?</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {PLAN_OPTIONS.map((opt) => (
            <button
              key={opt.shopTier}
              type="button"
              onClick={() => form.setValue("planShopTier", opt.shopTier, { shouldValidate: true })}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                Number(shopTier) === opt.shopTier
                  ? "border-primary bg-primary/5 ring-primary ring-1"
                  : "hover:bg-muted/50"
              }`}
            >
              <p className="font-medium">{opt.label}</p>
              <p className="text-muted-foreground text-xs">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Branches per shop (different stock & website)</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {BRANCH_PLAN_OPTIONS.map((opt) => (
            <button
              key={opt.branchTier}
              type="button"
              onClick={() =>
                form.setValue("planBranchTier", opt.branchTier, { shouldValidate: true })
              }
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                Number(branchTier) === opt.branchTier
                  ? "border-primary bg-primary/5 ring-primary ring-1"
                  : "hover:bg-muted/50"
              }`}
            >
              <p className="font-medium">{opt.label}</p>
              <p className="text-muted-foreground text-xs">{opt.addon}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-primary/5 border-primary/30 rounded-lg border p-4 text-sm">
        <p className="font-medium">Your plan</p>
        <p className="text-muted-foreground mt-1">{summary}</p>
        <p className="text-muted-foreground mt-2 text-xs">
          30-day free trial · card required to start · cancel anytime
        </p>
      </div>
    </div>
  );
}

/* ----------------------- step 2: shop ---------------------------- */

function ShopStep({
  form,
  onSlugTouched,
}: {
  form: UseFormReturn<FormIn, unknown, FormOut>;
  onSlugTouched: () => void;
}) {
  return (
    <div className="space-y-5">
      <Field
        id="displayName"
        label="Shop display name"
        hint="What customers will see on receipts and the storefront."
        register={form.register("displayName")}
        error={form.formState.errors.displayName?.message}
        autoFocus
      />

      <Field
        id="legalName"
        label="Legal / registered name"
        hint="The full registered company name (used for invoices)."
        register={form.register("legalName")}
        error={form.formState.errors.legalName?.message}
      />

      <Field
        id="slug"
        label="URL handle"
        hint="Used in shop links: shopos.app/<handle>. We'll auto-suffix if it's taken."
        register={form.register("slug", {
          onChange: () => onSlugTouched(),
        })}
        error={form.formState.errors.slug?.message}
      />

      <Field
        id="vatNumber"
        label="Irish VAT number (optional)"
        hint="Format: IE + 7 digits + 1-2 letters (e.g. IE1234567T). Leave blank if not yet VAT-registered."
        register={form.register("vatNumber")}
        error={form.formState.errors.vatNumber?.message}
        placeholder="IE1234567T"
      />

      <div className="bg-muted/50 rounded-md border p-3 text-xs">
        <div className="text-muted-foreground mb-1 tracking-wide uppercase">
          Defaults for Ireland
        </div>
        <div className="grid grid-cols-2 gap-y-1 sm:grid-cols-4">
          <span className="text-muted-foreground">Country</span>
          <span className="font-medium">Ireland</span>
          <span className="text-muted-foreground">Currency</span>
          <span className="font-medium">{DEFAULT_CURRENCY}</span>
          <span className="text-muted-foreground">Locale</span>
          <span className="font-medium">{DEFAULT_LOCALE}</span>
          <span className="text-muted-foreground">Timezone</span>
          <span className="font-medium">{DEFAULT_TIMEZONE}</span>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- step 2: branch -------------------------- */

function BranchStep({ form }: { form: UseFormReturn<FormIn, unknown, FormOut> }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="branchCode"
          label="Branch code"
          hint="Short uppercase code, unique within your shop (e.g. MAIN, PHIB, DUB1)."
          register={form.register("branchCode")}
          error={form.formState.errors.branchCode?.message}
          placeholder="MAIN"
        />
        <Field
          id="branchName"
          label="Branch name"
          hint="Customer-facing name for this location."
          register={form.register("branchName")}
          error={form.formState.errors.branchName?.message}
          placeholder="Greenway - Phibsborough"
        />
      </div>

      <Separator />

      <Field
        id="branchAddressLine1"
        label="Address line 1 (optional)"
        register={form.register("branchAddressLine1")}
        error={form.formState.errors.branchAddressLine1?.message}
        placeholder="12 North Circular Road"
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Field
          id="branchCity"
          label="City / Town"
          register={form.register("branchCity")}
          error={form.formState.errors.branchCity?.message}
          placeholder="Dublin"
        />
        <Field
          id="branchCounty"
          label="County"
          register={form.register("branchCounty")}
          error={form.formState.errors.branchCounty?.message}
          placeholder="Dublin"
        />
        <Field
          id="branchEircode"
          label="Eircode"
          register={form.register("branchEircode")}
          error={form.formState.errors.branchEircode?.message}
          placeholder="D07 XY12"
        />
      </div>
    </div>
  );
}

/* ----------------------- step 3: review -------------------------- */

function ReviewStep({ values, monthlyCents }: { values: FormIn; monthlyCents: number }) {
  const rows: { label: string; value: string }[] = useMemo(() => {
    const arr: { label: string; value: string }[] = [
      {
        label: "Subscription",
        value: `€${(monthlyCents / 100).toFixed(2)}/month after trial`,
      },
      {
        label: "Shops included",
        value: String(values.planShopTier ?? 1),
      },
      {
        label: "Branches per shop",
        value: String(values.planBranchTier ?? 1),
      },
      { label: "Display name", value: values.displayName },
      { label: "Legal name", value: values.legalName },
      { label: "URL handle", value: values.slug },
    ];
    if (values.vatNumber) arr.push({ label: "VAT number", value: values.vatNumber });
    arr.push({ label: "Branch code", value: values.branchCode });
    arr.push({ label: "Branch name", value: values.branchName });
    if (values.branchAddressLine1) arr.push({ label: "Address", value: values.branchAddressLine1 });
    const cityCounty = [values.branchCity, values.branchCounty].filter(Boolean).join(", ");
    if (cityCounty) arr.push({ label: "City / County", value: cityCounty });
    if (values.branchEircode) arr.push({ label: "Eircode", value: values.branchEircode });
    return arr;
  }, [values, monthlyCents]);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        We&apos;ll create your shop, your first branch, and put you in as the owner. You can edit
        any of these later in <span className="font-medium">Settings</span>.
      </p>

      <dl className="bg-muted/40 grid grid-cols-1 gap-y-2 rounded-md border p-4 text-sm sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-muted-foreground sm:col-span-1">{r.label}</dt>
            <dd className="text-foreground font-medium sm:col-span-2">{r.value}</dd>
          </div>
        ))}
      </dl>

      <Alert>
        <AlertDescription className="text-xs">
          Your shop starts on a 30-day trial. Next you&apos;ll add a card (demo mode locally). Then
          invite managers and cashiers — each can have their own password.
        </AlertDescription>
      </Alert>
    </div>
  );
}

/* ----------------------- shared field ---------------------------- */

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  autoFocus?: boolean;
  register: UseFormRegisterReturn;
}

function Field({ id, label, hint, error, placeholder, autoFocus, register }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-invalid={Boolean(error) || undefined}
        {...register}
      />
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
