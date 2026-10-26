import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StockListActions } from "@/components/products/stock-list-actions";
import { listStockForExport } from "@/lib/catalog/products/actions";
import { requireRole } from "@/lib/auth/tenant";
import { listBranchesForCurrentTenant } from "@/lib/pos/actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Stock · ShopOS" };

export default async function StockListPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const tenant = await requireRole(["owner", "manager", "warehouse"]);
  const sp = await searchParams;
  const branches = await listBranchesForCurrentTenant();
  const branch = branches.find((row) => row.id === sp.branch) ?? branches[0] ?? null;
  const rows = await listStockForExport(branch?.id ?? null);
  const headers = ["Name", "SKU", "Barcode", "Category", "Supplier", "On hand", "Unit", "Price"];
  const csvRows = rows.map((row) => [
    row.name,
    row.sku,
    row.barcode,
    row.category?.name,
    row.supplier?.name,
    row.available_qty,
    row.base_unit,
    row.selling_price,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/products"
            className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
          >
            <ArrowLeft className="size-3" /> Products
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Stock</h1>
          <p className="text-muted-foreground text-sm">
            {branch ? branch.name : "All branches"} · {rows.length} products
          </p>
        </div>
        <StockListActions filename="shopos-stock.csv" headers={headers} rows={csvRows} />
      </div>
      <div className="border-border overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell className="font-mono text-xs">{row.sku ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{row.barcode ?? "—"}</TableCell>
                <TableCell>{row.category?.name ?? "—"}</TableCell>
                <TableCell>{row.supplier?.name ?? "—"}</TableCell>
                <TableCell className="text-right font-mono">{row.available_qty ?? "—"}</TableCell>
                <TableCell>{row.base_unit}</TableCell>
                <TableCell className="text-right font-mono">
                  {row.selling_price.toFixed(2)} {tenant.currency}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
