"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveSupplierAction,
  createSupplierAction,
  restoreSupplierAction,
  updateSupplierAction,
} from "@/lib/suppliers/actions";
import { createSupplierSchema, type SupplierFullRow } from "@/lib/suppliers/schemas";

type FormIn = z.input<typeof createSupplierSchema>;
type FormOut = z.output<typeof createSupplierSchema>;

interface Props {
  mode: "create" | "edit";
  initial?: SupplierFullRow;
  canWrite: boolean;
}

export function SupplierForm({ mode, initial, canWrite }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [archivePending, startArchive] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: initial
      ? {
          code: initial.code ?? "",
          name: initial.name,
          legalName: initial.legal_name ?? "",
          vatNumber: initial.vat_number ?? "",
          contactName: initial.contact_name ?? "",
          email: initial.email ?? "",
          phone: initial.phone ?? "",
          addressLine1: initial.address_line1 ?? "",
          addressLine2: initial.address_line2 ?? "",
          city: initial.city ?? "",
          county: initial.county ?? "",
          eircode: initial.eircode ?? "",
          country: initial.country || "IE",
          paymentTerms: initial.payment_terms ?? "",
          defaultLeadTimeDays: initial.default_lead_time_days ?? undefined,
          defaultCurrency: initial.default_currency || "EUR",
          notes: initial.notes ?? "",
          isActive: initial.is_active,
        }
      : {
          name: "",
          country: "IE",
          defaultCurrency: "EUR",
          isActive: true,
          defaultLeadTimeDays: 7,
        },
  });

  function onSubmit(values: FormOut) {
    setServerError(null);
    startTransition(async () => {
      if (mode === "create") {
        const res = await createSupplierAction(values);
        if (res?.serverError) {
          setServerError(res.serverError);
          return;
        }
        if (res?.data?.ok) {
          toast.success("Supplier created");
          router.push("/suppliers");
        }
      } else {
        if (!initial) return;
        const res = await updateSupplierAction({ ...values, id: initial.id });
        if (res?.serverError) {
          setServerError(res.serverError);
          return;
        }
        if (res?.data?.ok) {
          toast.success("Supplier updated");
          router.refresh();
        }
      }
    });
  }

  function toggleArchive() {
    if (!initial) return;
    startArchive(async () => {
      const res = initial.is_active
        ? await archiveSupplierAction({ id: initial.id })
        : await restoreSupplierAction({ id: initial.id });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success(initial.is_active ? "Supplier archived" : "Supplier restored");
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {serverError ? (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>How this supplier appears on POs and invoices.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Code"
            hint="Short ID e.g. ACME (uppercased)"
            error={form.formState.errors.code?.message}
          >
            <Input placeholder="ACME" disabled={pending || !canWrite} {...form.register("code")} />
          </Field>

          <Field label="Name *" error={form.formState.errors.name?.message}>
            <Input
              placeholder="Acme Wholesale"
              disabled={pending || !canWrite}
              {...form.register("name")}
            />
          </Field>

          <Field
            label="Legal name"
            hint="If different from trading name"
            error={form.formState.errors.legalName?.message}
          >
            <Input disabled={pending || !canWrite} {...form.register("legalName")} />
          </Field>

          <Field
            label="VAT number"
            hint="e.g. IE1234567T"
            error={form.formState.errors.vatNumber?.message}
          >
            <Input
              placeholder="IE1234567T"
              disabled={pending || !canWrite}
              {...form.register("vatNumber")}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact name" error={form.formState.errors.contactName?.message}>
            <Input disabled={pending || !canWrite} {...form.register("contactName")} />
          </Field>

          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input type="email" disabled={pending || !canWrite} {...form.register("email")} />
          </Field>

          <Field label="Phone" error={form.formState.errors.phone?.message}>
            <Input disabled={pending || !canWrite} {...form.register("phone")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Address line 1"
            className="sm:col-span-2"
            error={form.formState.errors.addressLine1?.message}
          >
            <Input disabled={pending || !canWrite} {...form.register("addressLine1")} />
          </Field>
          <Field
            label="Address line 2"
            className="sm:col-span-2"
            error={form.formState.errors.addressLine2?.message}
          >
            <Input disabled={pending || !canWrite} {...form.register("addressLine2")} />
          </Field>
          <Field label="City" error={form.formState.errors.city?.message}>
            <Input disabled={pending || !canWrite} {...form.register("city")} />
          </Field>
          <Field label="County" error={form.formState.errors.county?.message}>
            <Input disabled={pending || !canWrite} {...form.register("county")} />
          </Field>
          <Field label="Eircode" error={form.formState.errors.eircode?.message}>
            <Input
              placeholder="D07 XY12"
              disabled={pending || !canWrite}
              {...form.register("eircode")}
            />
          </Field>
          <Field label="Country" hint="ISO 2-letter">
            <Input maxLength={2} disabled={pending || !canWrite} {...form.register("country")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trading terms</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment terms" hint="e.g. Net 30">
            <Input disabled={pending || !canWrite} {...form.register("paymentTerms")} />
          </Field>

          <Field
            label="Default lead time (days)"
            error={form.formState.errors.defaultLeadTimeDays?.message}
          >
            <Input
              type="number"
              min={0}
              max={365}
              disabled={pending || !canWrite}
              {...form.register("defaultLeadTimeDays", { valueAsNumber: true })}
            />
          </Field>

          <Field label="Default currency" hint="ISO 4217 (3 letters)">
            <Input
              maxLength={3}
              disabled={pending || !canWrite}
              {...form.register("defaultCurrency")}
            />
          </Field>

          <div className="space-y-2">
            <Label>Active</Label>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <div className="flex h-10 items-center gap-2">
                  <Switch
                    checked={field.value ?? true}
                    onCheckedChange={field.onChange}
                    disabled={pending || !canWrite}
                  />
                  <span className="text-muted-foreground text-sm">
                    {field.value ? "Active supplier" : "Archived"}
                  </span>
                </div>
              )}
            />
          </div>

          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={3} disabled={pending || !canWrite} {...form.register("notes")} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || !canWrite}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Save supplier"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/suppliers")}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>

        {mode === "edit" && initial && canWrite ? (
          <Button type="button" variant="outline" onClick={toggleArchive} disabled={archivePending}>
            {archivePending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : initial.is_active ? (
              "Archive supplier"
            ) : (
              "Restore supplier"
            )}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
