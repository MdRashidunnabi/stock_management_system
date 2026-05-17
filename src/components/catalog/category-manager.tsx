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
  archiveCategoryAction,
  createCategoryAction,
  restoreCategoryAction,
  updateCategoryAction,
} from "@/lib/catalog/categories/actions";
import {
  createCategorySchema,
  updateCategorySchema,
  type CategoryRow,
} from "@/lib/catalog/categories/schemas";
import type { z } from "zod";

type CreateInput = z.input<typeof createCategorySchema>;
type CreateOutput = z.output<typeof createCategorySchema>;
type UpdateInput = z.input<typeof updateCategorySchema>;
type UpdateOutput = z.output<typeof updateCategorySchema>;

interface Props {
  categories: CategoryRow[];
  canWrite: boolean;
}

export function CategoryManager({ categories, canWrite }: Props) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CategoryRow | null>(null);

  const createForm = useForm<CreateInput, unknown, CreateOutput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: "", slug: "", position: 0 },
  });

  function onCreate(values: CreateOutput) {
    setServerError(null);
    startTransition(async () => {
      const res = await createCategoryAction(values);
      if (res?.serverError) {
        setServerError(res.serverError);
        return;
      }
      if (res?.data?.ok) {
        toast.success(`Category "${res.data.category?.name}" created`);
        createForm.reset({ name: "", slug: "", position: 0 });
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a category</CardTitle>
          <CardDescription>
            Categories help group products on the POS and online shop. The slug is generated for you
            - leave it blank unless you want a specific URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!canWrite ? (
            <p className="text-muted-foreground text-sm">
              Only owners and managers can add categories.
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
                <Label htmlFor="cat-name">Name</Label>
                <Input
                  id="cat-name"
                  placeholder="e.g. Beverages"
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
                <Label htmlFor="cat-slug">Slug (optional)</Label>
                <Input
                  id="cat-slug"
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
          <CardTitle>All categories ({categories.length})</CardTitle>
          <CardDescription>
            Archived categories stay in the database for historical reports - you can restore them
            at any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {categories.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">
              No categories yet. Add your first one above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-center">Position</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="font-mono text-xs">{cat.slug}</TableCell>
                    <TableCell className="text-center">{cat.position}</TableCell>
                    <TableCell className="text-center">
                      {cat.is_active ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDateTimeIE(cat.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <CategoryRowActions cat={cat} canWrite={canWrite} onEdit={setEditing} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CategoryEditDialog category={editing} onClose={() => setEditing(null)} canWrite={canWrite} />
    </div>
  );
}

function CategoryRowActions({
  cat,
  canWrite,
  onEdit,
}: {
  cat: CategoryRow;
  canWrite: boolean;
  onEdit: (c: CategoryRow) => void;
}) {
  const [pending, startTransition] = useTransition();

  function toggleArchive() {
    startTransition(async () => {
      const res = cat.is_active
        ? await archiveCategoryAction({ id: cat.id })
        : await restoreCategoryAction({ id: cat.id });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success(cat.is_active ? "Archived" : "Restored");
    });
  }

  if (!canWrite) {
    return <span className="text-muted-foreground text-xs">Read-only</span>;
  }

  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" onClick={() => onEdit(cat)} disabled={pending}>
        <Pencil className="size-3.5" />
        <span className="sr-only">Edit</span>
      </Button>
      <Button size="sm" variant="ghost" onClick={toggleArchive} disabled={pending}>
        {cat.is_active ? <Archive className="size-3.5" /> : <ArchiveRestore className="size-3.5" />}
        <span className="sr-only">{cat.is_active ? "Archive" : "Restore"}</span>
      </Button>
    </div>
  );
}

function CategoryEditDialog({
  category,
  onClose,
  canWrite,
}: {
  category: CategoryRow | null;
  onClose: () => void;
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<UpdateInput, unknown, UpdateOutput>({
    resolver: zodResolver(updateCategorySchema),
    values: category
      ? {
          id: category.id,
          name: category.name,
          slug: category.slug,
          position: category.position,
          isActive: category.is_active,
        }
      : undefined,
  });

  function onSubmit(values: UpdateOutput) {
    setServerError(null);
    startTransition(async () => {
      const res = await updateCategoryAction(values);
      if (res?.serverError) {
        setServerError(res.serverError);
        return;
      }
      toast.success("Category updated");
      onClose();
    });
  }

  return (
    <Dialog open={Boolean(category)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit category</DialogTitle>
          <DialogDescription>Update the name, slug, position, or active status.</DialogDescription>
        </DialogHeader>

        {category ? (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {serverError ? (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}

            <input type="hidden" {...form.register("id")} />

            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                disabled={pending || !canWrite}
                aria-invalid={Boolean(form.formState.errors.name) || undefined}
                {...form.register("name")}
              />
              {form.formState.errors.name ? (
                <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-slug">Slug</Label>
              <Input
                id="edit-slug"
                disabled={pending || !canWrite}
                aria-invalid={Boolean(form.formState.errors.slug) || undefined}
                {...form.register("slug")}
              />
              {form.formState.errors.slug ? (
                <p className="text-destructive text-xs">{form.formState.errors.slug.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-position">Position</Label>
                <Input
                  id="edit-position"
                  type="number"
                  min={0}
                  step={1}
                  disabled={pending || !canWrite}
                  {...form.register("position", { valueAsNumber: true })}
                />
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
