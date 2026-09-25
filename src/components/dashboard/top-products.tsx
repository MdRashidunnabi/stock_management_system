import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TopProductRow } from "@/lib/reports/queries";

interface Props {
  rows: TopProductRow[];
  emptyHint?: string;
  currency?: string;
  locale?: string;
}

export function TopProducts({ rows, emptyHint, currency = "EUR", locale = "en" }: Props) {
  const money = (n: number) => formatMoney(n, currency, locale);
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">
        {emptyHint ?? "No sales yet."}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead className="text-right">Margin</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.product_id}>
              <TableCell className="text-xs">
                <div className="font-medium">{r.name}</div>
                {r.sku ? <div className="text-muted-foreground font-mono">{r.sku}</div> : null}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">{r.qty}</TableCell>
              <TableCell className="text-right font-mono text-xs">{money(r.revenue)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{money(r.profit)}</TableCell>
              <TableCell className="text-right font-mono text-xs">
                {r.margin_pct.toFixed(1)}%
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/products/${r.product_id}`}
                  aria-label={`Open ${r.name}`}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center"
                >
                  <ArrowRight className="size-3" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
