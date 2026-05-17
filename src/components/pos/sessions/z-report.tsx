import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CASH_MOVEMENT_LABEL, type SessionSummary } from "@/lib/pos/sessions/schemas";
import { formatDateTimeIE, formatEuro } from "@/lib/utils";

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  contactless: "Contactless",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  revolut: "Revolut",
  bank_transfer: "Bank transfer",
  store_credit: "Store credit",
  customer_account: "Customer account",
  voucher: "Voucher",
};

interface Props {
  summary: SessionSummary;
  shopName: string;
}

export function ZReport({ summary, shopName }: Props) {
  const { session, totals, payments, vat, cash_movements, cash_running } = summary;
  const isClosed = session.status !== "open";

  const variance = isClosed ? (session.cash_difference ?? 0) : 0;
  const varianceColor = !isClosed
    ? "text-muted-foreground"
    : Math.abs(variance) < 0.005
      ? "text-emerald-700 dark:text-emerald-400"
      : variance > 0
        ? "text-amber-700 dark:text-amber-400"
        : "text-destructive";

  return (
    <div
      className="border-border bg-card mx-auto max-w-3xl space-y-5 rounded-lg border p-6 text-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
      id="z-report"
    >
      <header className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{shopName}</h1>
        {session.branch ? (
          <p className="text-muted-foreground text-xs">
            {session.branch.code} · {session.branch.name}
          </p>
        ) : null}
        <p className="text-base font-semibold tracking-wide uppercase">
          {isClosed ? "Z-Report" : "X-Report (live, till still open)"}
        </p>
        <p className="text-muted-foreground text-xs">
          Cashier: <strong>{session.cashier_label}</strong>
        </p>
        <p className="text-muted-foreground text-xs">
          Opened {formatDateTimeIE(session.opened_at)}
          {session.closed_at ? ` · Closed ${formatDateTimeIE(session.closed_at)}` : ""}
        </p>
      </header>

      <hr className="border-border border-dashed" />

      {/* Sales totals */}
      <section className="space-y-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Sales summary
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Receipts" value={String(totals.sales_count)} />
          <Stat label="Items sold" value={String(totals.items_count)} />
          <Stat label="Discounts" value={formatEuro(totals.discount)} />
          <Stat label="Total (gross)" value={formatEuro(totals.gross)} highlight />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
          <Stat label="Net of VAT" value={formatEuro(totals.net)} />
          <Stat label="VAT" value={formatEuro(totals.vat)} />
        </div>
      </section>

      {/* Payments */}
      <section className="space-y-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Payments by method
        </h2>
        {payments.length === 0 ? (
          <p className="text-muted-foreground text-xs">No payments yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Receipts</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.method}>
                  <TableCell>{PAYMENT_LABEL[p.method] ?? p.method}</TableCell>
                  <TableCell className="text-right font-mono">{p.count}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(p.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* VAT */}
      <section className="space-y-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          VAT breakdown (Revenue.ie)
        </h2>
        {vat.length === 0 ? (
          <p className="text-muted-foreground text-xs">No VAT to report.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Net base</TableHead>
                <TableHead className="text-right">VAT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vat.map((v) => (
                <TableRow key={v.vat_code}>
                  <TableCell className="font-mono">{v.vat_code}</TableCell>
                  <TableCell className="text-right font-mono">
                    {(v.rate * 100).toFixed(v.rate < 0.1 ? 1 : 0)}%
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(v.net)}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(v.vat)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Cash drawer */}
      <section className="space-y-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Cash drawer
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Opening" value={formatEuro(cash_running.opening)} />
          <Stat label="Cash in" value={formatEuro(cash_running.cash_in)} />
          <Stat label="Cash out" value={formatEuro(cash_running.cash_out)} />
          <Stat label="Expected" value={formatEuro(cash_running.expected)} highlight />
        </div>
        {isClosed ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Counted" value={formatEuro(session.counted_cash ?? 0)} />
            <Stat label="Expected" value={formatEuro(session.expected_cash ?? 0)} />
            <div className="border-border bg-card rounded border p-2">
              <div className="text-muted-foreground text-[11px] tracking-wide uppercase">
                Variance
              </div>
              <div className={`font-mono text-base font-semibold ${varianceColor}`}>
                {formatEuro(variance)}
                {Math.abs(variance) > 0.005 ? (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {variance > 0 ? "surplus" : "shortage"}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* Cash movements list */}
      <section className="space-y-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Drawer movements ({cash_movements.length})
        </h2>
        {cash_movements.length === 0 ? (
          <p className="text-muted-foreground text-xs">No drawer movements yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>By</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cash_movements.map((m) => {
                const meta = CASH_MOVEMENT_LABEL[m.type] ?? { label: m.type, sign: "in" as const };
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDateTimeIE(m.created_at)}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{meta.label}</span>
                    </TableCell>
                    <TableCell className="text-xs">{m.reason ?? "-"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {m.user_label ?? "-"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-xs ${
                        meta.sign === "in"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-destructive"
                      }`}
                    >
                      {meta.sign === "in" ? "+" : "-"}
                      {formatEuro(m.amount)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      {session.closing_note ? (
        <p className="text-muted-foreground text-xs italic">Closing note: {session.closing_note}</p>
      ) : null}

      <p className="text-muted-foreground pt-2 text-center text-[11px]">
        Generated by ShopOS · {formatDateTimeIE(new Date().toISOString())}
      </p>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`border-border rounded border p-2 ${
        highlight ? "bg-accent/40 font-semibold" : "bg-card"
      }`}
    >
      <div className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
