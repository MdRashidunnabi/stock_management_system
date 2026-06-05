import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listLookupsForProductForm, listProducts } from "@/lib/catalog/products/actions";
import { requireTenant } from "@/lib/auth/tenant";
import { listBranchesForCurrentTenant } from "@/lib/pos/actions";
import { cn, formatEuro } from "@/lib/utils";

export const metadata = { title: "Products - ShopOS" };

interface SearchParams {
  q?: string;
  category?: string;
  brand?: string;
  supplier?: string;
  branch?: string;
  status?: string;
  page?: string;
}

function formatAvailableQty(qty: number, unit: string): string {
  const n = Number(qty);
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n - Math.round(n)) < 0.0001) return `${Math.round(n)} ${unit}`;
  return `${n.toFixed(2)} ${unit}`;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const tenant = await requireTenant();
  const sp = await searchParams;

  const canWrite = ["owner", "manager", "warehouse"].includes(tenant.role);
  const status =
    sp.status === "all" || sp.status === "archived" || sp.status === "active"
      ? sp.status
      : "active";
  const page = Number(sp.page ?? "1") || 1;

  const branches = await listBranchesForCurrentTenant();
  const activeBranchId =
    sp.branch && branches.some((b) => b.id === sp.branch) ? sp.branch : (branches[0]?.id ?? null);
  const activeBranch = branches.find((b) => b.id === activeBranchId) ?? null;

  const [{ rows, total, pageSize }, lookups] = await Promise.all([
    listProducts({
      search: sp.q,
      categoryId: sp.category || null,
      brandId: sp.brand || null,
      supplierId: sp.supplier || null,
      status,
      page,
      branchId: activeBranchId,
    }),
    listLookupsForProductForm(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const buildHref = (overrides: Partial<SearchParams>) => {
    const next = {
      ...sp,
      ...(activeBranchId ? { branch: activeBranchId } : {}),
      ...overrides,
    };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) {
      if (v && String(v).length > 0) params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground text-sm">
            Manage your full catalogue. Available stock is shown per branch (sellable units only).
            {activeBranch ? (
              <>
                {" "}
                Viewing: <span className="text-foreground font-medium">{activeBranch.code}</span>
              </>
            ) : null}
          </p>
        </div>
        {canWrite ? (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/products/import">
                <Upload className="size-4" />
                Bulk import
              </Link>
            </Button>
            <Button asChild>
              <Link href="/products/new">
                <Plus className="size-4" />
                New product
              </Link>
            </Button>
          </div>
        ) : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Submit to apply. Empty values are ignored.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
          >
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="q">Search</Label>
              <Input
                id="q"
                name="q"
                placeholder="Name, SKU, or barcode"
                defaultValue={sp.q ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                name="category"
                defaultValue={sp.category ?? ""}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">All</option>
                {lookups.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <select
                id="brand"
                name="brand"
                defaultValue={sp.brand ?? ""}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">All</option>
                {lookups.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={status}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Branch (stock)</Label>
              <select
                id="branch"
                name="branch"
                defaultValue={activeBranchId ?? ""}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                {branches.length === 0 ? (
                  <option value="">No branch</option>
                ) : (
                  branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="lg:col-span-6">
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Apply</Button>
                <Button asChild type="button" variant="ghost">
                  <Link href="/products">Reset</Link>
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results ({total})</CardTitle>
          <CardDescription>
            Page {page} of {totalPages} - {pageSize} per page.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">
              No products match these filters. Try clearing them, or add your first product.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Sell</TableHead>
                  <TableHead className="text-center">VAT</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/50">
                    <TableCell>
                      {p.primary_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.primary_image_url}
                          alt=""
                          className="size-10 rounded-md border object-cover"
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/products/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-muted-foreground text-xs">{p.base_unit}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.sku ?? <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.barcode ?? <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.category?.name ?? <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.brand?.name ?? <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.supplier?.name ?? <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {p.available_qty === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={cn(
                            p.available_qty <= 0
                              ? "text-rose-700 dark:text-rose-400"
                              : p.available_qty <= 5
                                ? "text-amber-700 dark:text-amber-400"
                                : undefined,
                          )}
                        >
                          {formatAvailableQty(p.available_qty, p.base_unit)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatEuro(Number(p.purchase_price ?? 0))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatEuro(Number(p.selling_price ?? 0))}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {p.vat_code}
                      <div className="text-muted-foreground text-[10px]">
                        {p.vat_included ? "incl" : "net"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {p.is_active ? (
                        <Badge>Active</Badge>
                      ) : (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link
              href={buildHref({ page: String(Math.max(1, page - 1)) })}
              aria-disabled={page <= 1}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Link>
          </Button>
          <span className="text-muted-foreground text-xs">
            Page {page} / {totalPages}
          </span>
          <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
            <Link
              href={buildHref({ page: String(Math.min(totalPages, page + 1)) })}
              aria-disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
