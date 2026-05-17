import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatDateTimeIE, formatEuro } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SessionVarianceRow } from "@/lib/reports/queries";

interface Props {
  rows: SessionVarianceRow[];
}

export function RecentShifts({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">
        No closed shifts in this period yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Closed</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Cashier</TableHead>
            <TableHead className="text-right">Expected</TableHead>
            <TableHead className="text-right">Counted</TableHead>
            <TableHead className="text-right">Variance</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const variance = r.cash_difference;
            const tone =
              Math.abs(variance) < 0.005
                ? "text-muted-foreground"
                : variance > 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400";
            return (
              <TableRow key={r.id}>
                <TableCell className="text-xs whitespace-nowrap">
                  {formatDateTimeIE(r.closed_at)}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {r.branch_code ? `${r.branch_code} · ` : ""}
                  {r.branch_name}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.cashier_label}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatEuro(r.expected_cash)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatEuro(r.counted_cash)}
                </TableCell>
                <TableCell className={`text-right font-mono text-xs ${tone}`}>
                  {formatEuro(r.cash_difference)}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/sessions/${r.id}`}
                    aria-label="Open session"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center"
                  >
                    <ArrowRight className="size-3" />
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
