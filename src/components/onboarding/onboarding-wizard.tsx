"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MapPin,
  Plus,
  Sparkles,
  Store,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  branchStepSchema,
  shopStepSchema,
  type BranchStepInput,
  type ShopStepInput,
} from "@/lib/onboarding/schemas";
import { planFromCounts } from "@/lib/billing/plans";
import { createTenantAction } from "@/lib/onboarding/actions";
import { slugify, cn } from "@/lib/utils";
import { useT } from "@/components/i18n/locale-provider";
import { CountrySelect } from "@/components/geo/country-select";
import { formatVatPercent, getCountry, vatPickerOptions } from "@/lib/geo/countries";

type Step = 1 | 2 | 3;
type ShopDraft = ShopStepInput & { key: string };
type BranchDraft = BranchStepInput & { key: string; shopKey: string };
type ShopFormIn = z.input<typeof shopStepSchema>;
type ShopFormOut = z.output<typeof shopStepSchema>;
type BranchFormIn = z.input<typeof branchStepSchema>;
type BranchFormOut = z.output<typeof branchStepSchema>;

function newKey(): string {
  return crypto.randomUUID();
}

function stepMeta(
  t: (path: string) => string,
): { id: Step; title: string; subtitle: string; icon: React.ReactNode }[] {
  return [
    {
      id: 1,
      title: t("onboard.shop"),
      subtitle: t("onboard.shopSub"),
      icon: <Store className="size-4" />,
    },
    {
      id: 2,
      title: t("onboard.branch"),
      subtitle: t("onboard.branchSub"),
      icon: <MapPin className="size-4" />,
    },
    {
      id: 3,
      title: t("onboard.review"),
      subtitle: t("onboard.reviewSub"),
      icon: <Check className="size-4" />,
    },
  ];
}

interface Props {
  ownerEmail: string;
  ownerName?: string | null;
  defaultCountry?: string | null;
}

export function OnboardingWizard({ ownerEmail, ownerName, defaultCountry }: Props) {
  const { t } = useT();
  const STEPS = stepMeta(t);
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = useState(false);
  const [shops, setShops] = useState<ShopDraft[]>([]);
  const [branches, setBranches] = useState<BranchDraft[]>([]);
  const [selectedShopKey, setSelectedShopKey] = useState<string>("");

  const initialCountry = defaultCountry && defaultCountry.length === 2 ? defaultCountry : "";

  const shopForm = useForm<ShopFormIn, unknown, ShopFormOut>({
    resolver: zodResolver(shopStepSchema),
    mode: "onTouched",
    defaultValues: {
      country: initialCountry,
      legalName: "",
      displayName: "",
      slug: "",
      vatNumber: "",
    },
  });

  const branchForm = useForm<BranchFormIn, unknown, BranchFormOut>({
    resolver: zodResolver(branchStepSchema),
    mode: "onTouched",
    defaultValues: {
      branchCode: "MAIN",
      branchName: "",
      branchAddressLine1: "",
      branchCity: "",
      branchCounty: "",
      branchEircode: "",
    },
  });

  const watchedDisplayName = shopForm.watch("displayName");
  const selectedShop = shops.find((s) => s.key === selectedShopKey) ?? null;
  const branchesForSelected = branches.filter((b) => b.shopKey === selectedShopKey);
  const maxBranchesPerShop = Math.max(
    0,
    ...shops.map((s) => branches.filter((b) => b.shopKey === s.key).length),
  );
  const plan = planFromCounts(Math.max(shops.length, 1), Math.max(maxBranchesPerShop, 1));
  const shopsMissingBranch = shops.filter((s) => !branches.some((b) => b.shopKey === s.key));

  useEffect(() => {
    if (slugTouched) return;
    shopForm.setValue("slug", slugify(watchedDisplayName ?? ""), { shouldValidate: false });
  }, [watchedDisplayName, slugTouched, shopForm]);

  useEffect(() => {
    if (step !== 2) return;
    if (!selectedShopKey && shops[0]) {
      setSelectedShopKey(shops[0].key);
    }
  }, [step, selectedShopKey, shops]);

  useEffect(() => {
    if (step !== 2 || !selectedShop) return;
    if (!branchForm.getValues("branchName")) {
      branchForm.setValue("branchName", selectedShop.displayName, { shouldValidate: false });
    }
    if (branchesForSelected.length > 0 && branchForm.getValues("branchCode") === "MAIN") {
      branchForm.setValue("branchCode", "", { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedShopKey]);

  function resetShopForm(country: string) {
    shopForm.reset({
      country,
      legalName: "",
      displayName: "",
      slug: "",
      vatNumber: "",
    });
    setSlugTouched(false);
  }

  function resetBranchForm(shopName: string, usedMain: boolean) {
    branchForm.reset({
      branchCode: usedMain ? "" : "MAIN",
      branchName: shopName,
      branchAddressLine1: "",
      branchCity: "",
      branchCounty: "",
      branchEircode: "",
    });
  }

  function addShop(values: ShopFormOut) {
    if (shops.length >= 30) {
      setServerError("You can add up to 30 shops.");
      return;
    }
    if (shops.some((s) => s.slug === values.slug)) {
      shopForm.setError("slug", {
        message: "That URL handle is already used by another shop here.",
      });
      return;
    }
    const key = newKey();
    setShops((prev) => [...prev, { ...values, key }]);
    if (!selectedShopKey) setSelectedShopKey(key);
    resetShopForm(values.country);
    setServerError(null);
    toast.success(`${values.displayName} added.`);
  }

  function removeShop(key: string) {
    setShops((prev) => {
      const next = prev.filter((s) => s.key !== key);
      setSelectedShopKey((current) => {
        if (current !== key) return current;
        return next[0]?.key ?? "";
      });
      return next;
    });
    setBranches((prev) => prev.filter((b) => b.shopKey !== key));
  }

  function addBranch(values: BranchFormOut) {
    if (!selectedShop) {
      setServerError("Pick a shop first.");
      return;
    }
    if (branchesForSelected.some((b) => b.branchCode === values.branchCode)) {
      branchForm.setError("branchCode", {
        message: "That branch code is already used in this shop.",
      });
      return;
    }
    if (branchesForSelected.length >= 30) {
      setServerError("This shop already has 30 branches.");
      return;
    }
    setBranches((prev) => [...prev, { ...values, key: newKey(), shopKey: selectedShop.key }]);
    resetBranchForm(selectedShop.displayName, true);
    setServerError(null);
    toast.success(`Branch ${values.branchName} added to ${selectedShop.displayName}.`);
  }

  function removeBranch(key: string) {
    setBranches((prev) => prev.filter((b) => b.key !== key));
  }

  function goNext() {
    setServerError(null);
    if (step === 1) {
      if (shops.length === 0) {
        setServerError("Add at least one shop.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (shopsMissingBranch.length > 0) {
        setServerError(
          `Add a branch for: ${shopsMissingBranch.map((s) => s.displayName).join(", ")}.`,
        );
        return;
      }
      setStep(3);
    }
  }

  function goBack() {
    setServerError(null);
    setStep((s) => (s === 1 ? 1 : ((s - 1) as Step)));
  }

  function onCreate() {
    setServerError(null);
    startTransition(async () => {
      const res = await createTenantAction({ shops, branches });
      if (res?.serverError) {
        setServerError(res.serverError);
        toast.error(res.serverError);
        return;
      }
      if (res?.validationErrors) {
        setServerError("Please review the shops and branches for errors.");
        return;
      }
      if (res?.data?.ok) {
        toast.success("Shops created — add your card to start your free trial.");
        router.replace("/onboarding/subscribe");
        router.refresh();
      }
    });
  }

  const currentStepMeta = STEPS.find((s) => s.id === step)!;
  const priceLabel = `${shops.length || 0} shop${shops.length === 1 ? "" : "s"} · busiest shop has ${maxBranchesPerShop} branch${maxBranchesPerShop === 1 ? "" : "es"} — €${(plan.monthlyCents / 100).toFixed(2)}/month`;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Set up your shop on ShopOS
        </h1>
        <p className="text-muted-foreground text-sm">
          Signed in as{" "}
          <span className="text-foreground font-medium">{ownerName ?? ownerEmail}</span>. Add shops
          first. Then pick a shop and add its branches — they stay with that shop.
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

      <div className="bg-primary/5 border-primary/30 rounded-lg border px-4 py-3 text-sm">
        <p className="font-medium">Price updates as you add shops and branches</p>
        <p className="text-muted-foreground mt-0.5">{priceLabel}</p>
      </div>

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

          {step === 1 ? (
            <ShopsStep
              form={shopForm}
              shops={shops}
              branches={branches}
              onSlugTouched={() => setSlugTouched(true)}
              onAdd={addShop}
              onRemove={removeShop}
              t={t}
            />
          ) : null}

          {step === 2 ? (
            <BranchesStep
              shops={shops}
              selectedShopKey={selectedShopKey}
              onSelectShop={(key) => {
                setSelectedShopKey(key);
                const shop = shops.find((s) => s.key === key);
                const usedMain = branches.some((b) => b.shopKey === key && b.branchCode === "MAIN");
                resetBranchForm(shop?.displayName ?? "", usedMain);
              }}
              branchesForSelected={branchesForSelected}
              form={branchForm}
              onAdd={addBranch}
              onRemove={removeBranch}
              t={t}
            />
          ) : null}

          {step === 3 ? (
            <ReviewStep shops={shops} branches={branches} monthlyCents={plan.monthlyCents} />
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-1 flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={goBack} disabled={pending || step === 1}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={goNext} disabled={pending}>
            Continue <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button type="button" onClick={onCreate} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Creating
              </>
            ) : (
              <>
                Create my shops <Sparkles className="size-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function ShopsStep({
  form,
  shops,
  branches,
  onSlugTouched,
  onAdd,
  onRemove,
  t,
}: {
  form: ReturnType<typeof useForm<ShopFormIn, unknown, ShopFormOut>>;
  shops: ShopDraft[];
  branches: BranchDraft[];
  onSlugTouched: () => void;
  onAdd: (values: ShopFormOut) => void;
  onRemove: (key: string) => void;
  t: (path: string, vars?: Record<string, string>) => string;
}) {
  const countryCode = form.watch("country");
  const country = getCountry(typeof countryCode === "string" ? countryCode : "");

  return (
    <div className="space-y-5">
      {shops.length > 0 ? (
        <ul className="space-y-2">
          {shops.map((shop, index) => {
            const count = branches.filter((b) => b.shopKey === shop.key).length;
            return (
              <li
                key={shop.key}
                className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {index + 1}. {shop.displayName}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {shop.slug} · {getCountry(shop.country)?.name ?? shop.country} · {count}{" "}
                    {count === 1 ? "branch" : "branches"}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(shop.key)}>
                  <Trash2 className="size-4" />
                  <span className="sr-only">Remove {shop.displayName}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          Add your first shop. You can add more after this one.
        </p>
      )}

      <Separator />

      <form className="space-y-5" onSubmit={form.handleSubmit(onAdd)} noValidate>
        <div className="space-y-2">
          <Label htmlFor="country">{t("onboard.country")}</Label>
          <CountrySelect
            id="country"
            value={typeof countryCode === "string" ? countryCode : ""}
            onChange={(code) => form.setValue("country", code, { shouldValidate: true })}
            invalid={Boolean(form.formState.errors.country)}
          />
          {form.formState.errors.country ? (
            <p className="text-destructive text-xs">{form.formState.errors.country.message}</p>
          ) : null}
        </div>

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
          register={form.register("slug", { onChange: () => onSlugTouched() })}
          error={form.formState.errors.slug?.message}
        />
        <Field
          id="vatNumber"
          label={country ? `${country.vatIdLabel} (optional)` : t("onboard.vatNumber")}
          hint={t("onboard.vatHint")}
          register={form.register("vatNumber")}
          error={form.formState.errors.vatNumber?.message}
        />

        {country ? (
          <div className="bg-muted/50 rounded-md border p-3 text-xs">
            <div className="text-muted-foreground mb-1 tracking-wide uppercase">
              {t("onboard.taxTitle")}
            </div>
            <div className="grid grid-cols-2 gap-y-1 sm:grid-cols-4">
              <span className="text-muted-foreground">{t("onboard.country")}</span>
              <span className="font-medium">{country.name}</span>
              <span className="text-muted-foreground">{t("onboard.currency")}</span>
              <span className="font-medium">{country.currency}</span>
              <span className="text-muted-foreground">{t("onboard.timezone")}</span>
              <span className="font-medium">{country.timezone}</span>
              <span className="text-muted-foreground">VAT</span>
              <span className="font-medium">
                {t("onboard.taxStd", { pct: formatVatPercent(country.vatRates.STD) })}
              </span>
            </div>
            <ul className="text-muted-foreground mt-2 space-y-0.5">
              {vatPickerOptions(country.vatRates).map((r) => (
                <li key={r.code}>
                  {r.code}: {r.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Button type="submit" variant="outline" className="w-full">
          <Plus className="size-4" />
          {shops.length === 0 ? "Add shop" : "Add more shop"}
        </Button>
      </form>
    </div>
  );
}

function BranchesStep({
  shops,
  selectedShopKey,
  onSelectShop,
  branchesForSelected,
  form,
  onAdd,
  onRemove,
  t,
}: {
  shops: ShopDraft[];
  selectedShopKey: string;
  onSelectShop: (key: string) => void;
  branchesForSelected: BranchDraft[];
  form: ReturnType<typeof useForm<BranchFormIn, unknown, BranchFormOut>>;
  onAdd: (values: BranchFormOut) => void;
  onRemove: (key: string) => void;
  t: (path: string) => string;
}) {
  const selected = shops.find((s) => s.key === selectedShopKey);
  const country = getCountry(selected?.country ?? "");

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="shopKey">Shop</Label>
        <select
          id="shopKey"
          className={cn(
            "border-input bg-background h-9 w-full rounded-md border px-3 text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
          )}
          value={selectedShopKey}
          onChange={(e) => onSelectShop(e.target.value)}
        >
          <option value="" disabled>
            Pick a shop
          </option>
          {shops.map((shop) => (
            <option key={shop.key} value={shop.key}>
              {shop.displayName}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          Branches you add now belong only to this shop. Switch shops in this list to add locations
          to another shop.
        </p>
      </div>

      {selected ? (
        <>
          {branchesForSelected.length > 0 ? (
            <ul className="space-y-2">
              {branchesForSelected.map((branch) => (
                <li
                  key={branch.key}
                  className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {branch.branchCode} · {branch.branchName}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Only in {selected.displayName}
                      {branch.branchCity ? ` · ${branch.branchCity}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(branch.key)}
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Remove branch {branch.branchCode}</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No branches on {selected.displayName} yet. Add the first location below.
            </p>
          )}

          <Separator />

          <form className="space-y-5" onSubmit={form.handleSubmit(onAdd)} noValidate>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                id="branchCode"
                label="Branch code"
                hint="Unique inside this shop (e.g. MAIN, LIS1)."
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
                placeholder="Main branch"
              />
            </div>
            <Field
              id="branchAddressLine1"
              label="Address line 1 (optional)"
              register={form.register("branchAddressLine1")}
              error={form.formState.errors.branchAddressLine1?.message}
              placeholder="Main street"
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <Field
                id="branchCity"
                label="City / Town"
                register={form.register("branchCity")}
                error={form.formState.errors.branchCity?.message}
              />
              <Field
                id="branchCounty"
                label={country?.regionLabel ?? t("onboard.region")}
                register={form.register("branchCounty")}
                error={form.formState.errors.branchCounty?.message}
              />
              <Field
                id="branchEircode"
                label={country?.postalLabel ?? t("onboard.postal")}
                register={form.register("branchEircode")}
                error={form.formState.errors.branchEircode?.message}
              />
            </div>
            <Button type="submit" variant="outline" className="w-full">
              <Plus className="size-4" />
              {branchesForSelected.length === 0 ? "Add branch" : "Add more branch"}
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
}

function ReviewStep({
  shops,
  branches,
  monthlyCents,
}: {
  shops: ShopDraft[];
  branches: BranchDraft[];
  monthlyCents: number;
}) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        We&apos;ll create each shop with only the branches you attached to it. You can edit these
        later in Settings.
      </p>
      <p className="text-sm font-medium">
        Subscription: €{(monthlyCents / 100).toFixed(2)}/month after trial
      </p>
      <ul className="space-y-3">
        {shops.map((shop) => {
          const shopBranches = branches.filter((b) => b.shopKey === shop.key);
          const country = getCountry(shop.country);
          return (
            <li key={shop.key} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{shop.displayName}</p>
              <p className="text-muted-foreground text-xs">
                {shop.legalName} · {shop.slug}
                {country ? ` · ${country.name} · ${country.currency}` : ""}
                {shop.vatNumber ? ` · ${shop.vatNumber}` : ""}
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {shopBranches.map((b) => (
                  <li key={b.key}>
                    {b.branchCode} — {b.branchName}
                    {b.branchCity ? `, ${b.branchCity}` : ""}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      <Alert>
        <AlertDescription className="text-xs">
          Your shops start on a 30-day trial. Next you&apos;ll add a payment method. You will not be
          charged until the trial ends.
        </AlertDescription>
      </Alert>
    </div>
  );
}

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
