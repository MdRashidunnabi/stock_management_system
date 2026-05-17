import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, KeyRound } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { listSessions } from "@/lib/pos/sessions/actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeIE, formatEuro } from "@/lib/utils";

export const metadata = { title: "Till sessions · ShopOS" };

export default async function SessionsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const sessions = await listSessions({ limit: 100 });
  const open = sessions.filter((s) => s.status === "open");
  const closed = sessions.filter((s) => s.status !== "open");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Till sessions</h1>
          <p className="text-muted-foreground text-sm">
            Each shift the cashier opens a till with a starting cash float, takes payments, and
            closes it with a counted cash total. The variance lands here.
          </p>
        </div>
        <Link
          href="/sessions/open"
          className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
        >
          <KeyRound className="size-4" /> Open a till
        </Link>
      </div>

      <SessionsTable
        title="Open right now"
        emptyHint="No till is open. Use the button above to start a shift."
        rows={open}
        showVariance={false}
      />

      <SessionsTable
        title="Closed"
        emptyHint="Closed sessions will appear here after you finish a shift."
        rows={closed}
        showVariance={true}
      />
    </div>
  );
}

function SessionsTable({
  title,
  rows,
  emptyHint,
  showVariance,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof listSessions>>;
  emptyHint: string;
  showVariance: boolean;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">{title}</h2>
      <div className="border-border bg-card overflow-x-auto rounded-lg border">
        {rows.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">{emptyHint}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Closed</TableHead>
                <TableHead>Cashier</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                {showVariance ? (
                  <>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </>
                ) : null}
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => {
                const variance = s.cash_difference ?? 0;
                const varianceColor =
                  Math.abs(variance) < 0.005
                    ? "text-muted-foreground"
                    : variance > 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-destructive";
                return (
                  <TableRow key={s.id} className="hover:bg-muted/40">
                    <TableCell className="text-xs whitespace-nowrap">
                      {s.branch ? `${s.branch.code} · ${s.branch.name}` : "-"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDateTimeIE(s.opened_at)}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {s.closed_at ? formatDateTimeIE(s.closed_at) : "-"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{s.cashier_label}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatEuro(s.opening_cash)}
                    </TableCell>
                    {showVariance ? (
                      <>
                        <TableCell className="text-right font-mono text-xs">
                          {s.expected_cash != null ? formatEuro(s.expected_cash) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {s.counted_cash != null ? formatEuro(s.counted_cash) : "-"}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-xs ${varianceColor}`}>
                          {s.cash_difference != null ? formatEuro(s.cash_difference) : "-"}
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell>
                      <Badge
                        variant={s.status === "open" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {s.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/sessions/${s.id}`}
                        className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                      >
                        Open <ArrowRight className="size-3" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
}
