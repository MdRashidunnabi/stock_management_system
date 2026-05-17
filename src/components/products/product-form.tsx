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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { IE_VAT_RATES } from "@/lib/constants";
import {
  archiveProductAction,
  createProductAction,
  restoreProductAction,
  updateProductAction,
} from "@/lib/catalog/products/actions";
import { createProductSchema, type ProductFullRow } from "@/lib/catalog/products/schemas";

type FormIn = z.input<typeof createProductSchema>;
type FormOut = z.output<typeof createProductSchema>;

interface LookupItem {
  id: string;
  name: string;
  code?: string | null;
}

interface Props {
  mode: "create" | "edit";
  initial?: ProductFullRow;
  canWrite: boolean;
  categories: LookupItem[];
  brands: LookupItem[];
  suppliers: LookupItem[];
}

const NONE = "__none__";

export function ProductForm({ mode, initial, canWrite, categories, brands, suppliers }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [archivePending, startArchive] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(createProductSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          sku: initial.sku ?? "",
          barcode: initial.barcode ?? "",
          shortNameForReceipt: initial.short_name_for_receipt ?? "",
          descriptionShort: initial.description_short ?? "",
          descriptionLong: initial.description_long ?? "",
          categoryId: initial.category_id ?? "",
          brandId: initial.brand_id ?? "",
          defaultSupplierId: initial.default_supplier_id ?? "",
          purchasePrice: Number(initial.purchase_price ?? 0),
          sellingPrice: Number(initial.selling_price ?? 0),
          vatCode: (initial.vat_code as FormIn["vatCode"]) ?? "STD",
          vatIncluded: initial.vat_included,
          baseUnit: initial.base_unit ?? "un",
          weighable: initial.weighable,
          decimalQtyAllowed: initial.decimal_qty_allowed,
          isActive: initial.is_active,
        }
      : {
          name: "",
          sku: "",
          barcode: "",
          purchasePrice: 0,
          sellingPrice: 0,
          vatCode: "STD",
          vatIncluded: true,
          baseUnit: "un",
          weighable: false,
          decimalQtyAllowed: false,
          isActive: true,
        },
  });

  function onSubmit(values: FormOut) {
    setServerError(null);
    startTransition(async () => {
      if (mode === "create") {
        const res = await createProductAction(values);
        if (res?.serverError) {
          setServerError(res.serverError);
          return;
        }
        if (res?.data?.ok) {
          toast.success("Product created");
          router.push(`/products/${res.data.id}`);
          router.refresh();
        }
      } else {
        if (!initial) return;
        const res = await updateProductAction({ ...values, id: initial.id });
        if (res?.serverError) {
          setServerError(res.serverError);
          return;
        }
        if (res?.data?.ok) {
          toast.success("Product saved");
          router.refresh();
        }
      }
    });
  }

  function toggleArchive() {
    if (!initial) return;
    startArchive(async () => {
      const res = initial.is_active
        ? await archiveProductAction({ id: initial.id })
        : await restoreProductAction({ id: initial.id });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success(initial.is_active ? "Product archived" : "Product restored");
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
          <CardTitle>Basics</CardTitle>
          <CardDescription>Name, codes, and what shows on receipts.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Name *"
            error={form.formState.errors.name?.message}
            className="sm:col-span-2"
          >
            <Input
              placeholder="Tayto Cheese & Onion 45g"
              disabled={pending || !canWrite}
              {...form.register("name")}
            />
          </Field>

          <Field
            label="SKU"
            hint="Internal stock-keeping code"
            error={form.formState.errors.sku?.message}
          >
            <Input
              placeholder="TAY-CO-45"
              disabled={pending || !canWrite}
              {...form.register("sku")}
            />
          </Field>

          <Field label="Barcode" hint="EAN-13 / UPC" error={form.formState.errors.barcode?.message}>
            <Input
              placeholder="5012345678900"
              disabled={pending || !canWrite}
              {...form.register("barcode")}
            />
          </Field>

          <Field
            label="Receipt label"
            hint="Short name on receipts (≤ 60 chars)"
            error={form.formState.errors.shortNameForReceipt?.message}
            className="sm:col-span-2"
          >
            <Input disabled={pending || !canWrite} {...form.register("shortNameForReceipt")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Classification</CardTitle>
          <CardDescription>Used for navigation, filtering, and reports.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Category" error={form.formState.errors.categoryId?.message}>
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <Select
                  value={field.value && field.value.length > 0 ? field.value : NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                  disabled={pending || !canWrite}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Brand" error={form.formState.errors.brandId?.message}>
            <Controller
              control={form.control}
              name="brandId"
              render={({ field }) => (
                <Select
                  value={field.value && field.value.length > 0 ? field.value : NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                  disabled={pending || !canWrite}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field
            label="Default supplier"
            hint="Used as fallback on POs"
            error={form.formState.errors.defaultSupplierId?.message}
          >
            <Controller
              control={form.control}
              name="defaultSupplierId"
              render={({ field }) => (
                <Select
                  value={field.value && field.value.length > 0 ? field.value : NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                  disabled={pending || !canWrite}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.code ? `${s.code} - ${s.name}` : s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing & VAT</CardTitle>
          <CardDescription>
            Irish retailers usually display prices VAT-inclusive. The receipt will break out the VAT
            line automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Purchase price (€)" hint="Weighted average">
            <Input
              type="number"
              step="0.01"
              min={0}
              disabled={pending || !canWrite}
              {...form.register("purchasePrice", { valueAsNumber: true })}
            />
          </Field>

          <Field label="Selling price (€)">
            <Input
              type="number"
              step="0.01"
              min={0}
              disabled={pending || !canWrite}
              {...form.register("sellingPrice", { valueAsNumber: true })}
            />
          </Field>

          <Field label="VAT code">
            <Controller
              control={form.control}
              name="vatCode"
              render={({ field }) => (
                <Select
                  value={field.value ?? "STD"}
                  onValueChange={field.onChange}
                  disabled={pending || !canWrite}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IE_VAT_RATES.map((r) => (
                      <SelectItem key={r.code} value={r.code}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <div className="space-y-2">
            <Label>VAT inclusive price?</Label>
            <Controller
              control={form.control}
              name="vatIncluded"
              render={({ field }) => (
                <div className="flex h-10 items-center gap-2">
                  <Switch
                    checked={field.value ?? true}
                    onCheckedChange={field.onChange}
                    disabled={pending || !canWrite}
                  />
                  <span className="text-muted-foreground text-sm">
                    {field.value ? "Selling price is VAT-inclusive" : "Selling price is net"}
                  </span>
                </div>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Units & status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Base unit *"
            hint="un, kg, L, m..."
            error={form.formState.errors.baseUnit?.message}
          >
            <Input maxLength={8} disabled={pending || !canWrite} {...form.register("baseUnit")} />
          </Field>

          <div className="space-y-2">
            <Label>Sold by weight</Label>
            <Controller
              control={form.control}
              name="weighable"
              render={({ field }) => (
                <div className="flex h-10 items-center gap-2">
                  <Switch
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    disabled={pending || !canWrite}
                  />
                  <span className="text-muted-foreground text-sm">
                    {field.value ? "Yes" : "No"}
                  </span>
                </div>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Allow decimals</Label>
            <Controller
              control={form.control}
              name="decimalQtyAllowed"
              render={({ field }) => (
                <div className="flex h-10 items-center gap-2">
                  <Switch
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    disabled={pending || !canWrite}
                  />
                  <span className="text-muted-foreground text-sm">
                    {field.value ? "0.5, 1.25..." : "Whole numbers"}
                  </span>
                </div>
              )}
            />
          </div>

          <Field
            label="Description (short)"
            hint="Shown on the POS"
            className="sm:col-span-3"
            error={form.formState.errors.descriptionShort?.message}
          >
            <Input disabled={pending || !canWrite} {...form.register("descriptionShort")} />
          </Field>

          <Field
            label="Description (long)"
            hint="For the online shop, supports plain text"
            className="sm:col-span-3"
            error={form.formState.errors.descriptionLong?.message}
          >
            <Textarea
              rows={3}
              disabled={pending || !canWrite}
              {...form.register("descriptionLong")}
            />
          </Field>

          <div className="space-y-2 sm:col-span-3">
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
                    {field.value
                      ? "Visible on POS and reports"
                      : "Hidden (kept for historical sales)"}
                  </span>
                </div>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || !canWrite}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Save product"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/products")}
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
              "Archive product"
            ) : (
              "Restore product"
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
