import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LowStockRow } from "@/lib/reports/queries";

interface Props {
  rows: LowStockRow[];
}

export function LowStockList({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="space-y-2 p-6 text-center">
        <p className="text-muted-foreground text-sm">
          No low-stock alerts. Set a per-branch <span className="font-mono">min_stock</span> on a
          product to start tracking reorders.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead className="text-right">On hand</TableHead>
            <TableHead className="text-right">Min</TableHead>
            <TableHead className="text-right">Shortfall</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.product_id}-${r.branch_id}`}>
              <TableCell className="text-xs">
                <Link href={`/products/${r.product_id}`} className="hover:text-primary font-medium">
                  {r.name}
                </Link>
                {r.sku ? <div className="text-muted-foreground font-mono">{r.sku}</div> : null}
              </TableCell>
              <TableCell className="text-xs">
                {r.branch_code ? `${r.branch_code} · ` : ""}
                {r.branch_name}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {r.on_hand <= 0 ? (
                  <span className="text-rose-700 dark:text-rose-400">{r.on_hand}</span>
                ) : (
                  r.on_hand
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">{r.min_stock}</TableCell>
              <TableCell className="text-right font-mono text-xs">
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-3" />
                  {r.shortfall}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
