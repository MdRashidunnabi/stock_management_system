"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeIE } from "@/lib/utils";
import {
  archiveBrandAction,
  createBrandAction,
  restoreBrandAction,
  updateBrandAction,
} from "@/lib/catalog/brands/actions";
import { createBrandSchema, updateBrandSchema, type BrandRow } from "@/lib/catalog/brands/schemas";
import type { z } from "zod";

type CreateInput = z.input<typeof createBrandSchema>;
type CreateOutput = z.output<typeof createBrandSchema>;
type UpdateInput = z.input<typeof updateBrandSchema>;
type UpdateOutput = z.output<typeof updateBrandSchema>;

interface Props {
  brands: BrandRow[];
  canWrite: boolean;
}

export function BrandManager({ brands, canWrite }: Props) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BrandRow | null>(null);

  const createForm = useForm<CreateInput, unknown, CreateOutput>({
    resolver: zodResolver(createBrandSchema),
    defaultValues: { name: "", slug: "" },
  });

  function onCreate(values: CreateOutput) {
    setServerError(null);
    startTransition(async () => {
      const res = await createBrandAction(values);
      if (res?.serverError) {
        setServerError(res.serverError);
        return;
      }
      if (res?.data?.ok) {
        toast.success(`Brand "${res.data.brand?.name}" created`);
        createForm.reset({ name: "", slug: "" });
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a brand</CardTitle>
          <CardDescription>
            Brands let you filter products in reports (e.g. by manufacturer or supplier brand).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!canWrite ? (
            <p className="text-muted-foreground text-sm">
              Only owners and managers can add brands.
            </p>
          ) : (
            <form
              onSubmit={createForm.handleSubmit(onCreate)}
              className="grid gap-3 sm:grid-cols-[2fr_1.5fr_auto] sm:items-end"
              noValidate
            >
              {serverError ? (
                <Alert variant="destructive" className="sm:col-span-3">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="brand-name">Name</Label>
                <Input
                  id="brand-name"
                  placeholder="e.g. Tayto"
                  disabled={pending}
                  aria-invalid={Boolean(createForm.formState.errors.name) || undefined}
                  {...createForm.register("name")}
                />
                {createForm.formState.errors.name ? (
                  <p className="text-destructive text-xs">
                    {createForm.formState.errors.name.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand-slug">Slug (optional)</Label>
                <Input
                  id="brand-slug"
                  placeholder="auto-generated"
                  disabled={pending}
                  {...createForm.register("slug")}
                />
              </div>

              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Add"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All brands ({brands.length})</CardTitle>
          <CardDescription>
            Archived brands stay attached to existing products but are hidden from new product
            forms.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {brands.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">No brands yet. Add one above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell className="font-mono text-xs">{brand.slug}</TableCell>
                    <TableCell className="text-center">
                      {brand.is_active ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDateTimeIE(brand.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <BrandRowActions brand={brand} canWrite={canWrite} onEdit={setEditing} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BrandEditDialog brand={editing} onClose={() => setEditing(null)} canWrite={canWrite} />
    </div>
  );
}

function BrandRowActions({
  brand,
  canWrite,
  onEdit,
}: {
  brand: BrandRow;
  canWrite: boolean;
  onEdit: (b: BrandRow) => void;
}) {
  const [pending, startTransition] = useTransition();

  function toggleArchive() {
    startTransition(async () => {
      const res = brand.is_active
        ? await archiveBrandAction({ id: brand.id })
        : await restoreBrandAction({ id: brand.id });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success(brand.is_active ? "Archived" : "Restored");
    });
  }

  if (!canWrite) {
    return <span className="text-muted-foreground text-xs">Read-only</span>;
  }

  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" onClick={() => onEdit(brand)} disabled={pending}>
        <Pencil className="size-3.5" />
        <span className="sr-only">Edit</span>
      </Button>
      <Button size="sm" variant="ghost" onClick={toggleArchive} disabled={pending}>
        {brand.is_active ? (
          <Archive className="size-3.5" />
        ) : (
          <ArchiveRestore className="size-3.5" />
        )}
        <span className="sr-only">{brand.is_active ? "Archive" : "Restore"}</span>
      </Button>
    </div>
  );
}

function BrandEditDialog({
  brand,
  onClose,
  canWrite,
}: {
  brand: BrandRow | null;
  onClose: () => void;
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<UpdateInput, unknown, UpdateOutput>({
    resolver: zodResolver(updateBrandSchema),
    values: brand
      ? {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          isActive: brand.is_active,
        }
      : undefined,
  });

  function onSubmit(values: UpdateOutput) {
    setServerError(null);
    startTransition(async () => {
      const res = await updateBrandAction(values);
      if (res?.serverError) {
        setServerError(res.serverError);
        return;
      }
      toast.success("Brand updated");
      onClose();
    });
  }

  return (
    <Dialog open={Boolean(brand)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit brand</DialogTitle>
          <DialogDescription>Update the name, slug, or active status.</DialogDescription>
        </DialogHeader>

        {brand ? (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {serverError ? (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}

            <input type="hidden" {...form.register("id")} />

            <div className="space-y-2">
              <Label htmlFor="edit-brand-name">Name</Label>
              <Input
                id="edit-brand-name"
                disabled={pending || !canWrite}
                aria-invalid={Boolean(form.formState.errors.name) || undefined}
                {...form.register("name")}
              />
              {form.formState.errors.name ? (
                <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-brand-slug">Slug</Label>
              <Input
                id="edit-brand-slug"
                disabled={pending || !canWrite}
                aria-invalid={Boolean(form.formState.errors.slug) || undefined}
                {...form.register("slug")}
              />
              {form.formState.errors.slug ? (
                <p className="text-destructive text-xs">{form.formState.errors.slug.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Active</Label>
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <div className="flex h-10 items-center gap-2">
                    <Switch
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                      disabled={pending || !canWrite}
                    />
                    <span className="text-muted-foreground text-sm">
                      {field.value ? "Visible in lists" : "Archived"}
                    </span>
                  </div>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !canWrite}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
