import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { listBranchesForCurrentTenant } from "@/lib/pos/actions";
import { getShiftAccount } from "@/lib/pos/sessions/actions";
import { ShiftSelect } from "@/components/pos/sessions/shift-select";
import { SaveShiftAccountForm } from "@/components/pos/sessions/save-shift-account-form";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  defaultBusinessDateISO,
  formatTillLabel,
  parseShiftCode,
  SHIFT_LABELS,
  suggestShiftCode,
} from "@/lib/pos/shifts";
import { formatEuro } from "@/lib/utils";

export const metadata = { title: "Shift accounting · ShopOS" };

export default async function ShiftAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; date?: string; shift?: string }>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const params = await searchParams;
  const branches = await listBranchesForCurrentTenant();
  if (branches.length === 0) {
    return (
      <div className="border-border bg-card mx-auto max-w-md rounded-xl border p-6 text-center">
        <h1 className="text-lg font-semibold">No active branch</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Add a branch before accounting a shift.
        </p>
      </div>
    );
  }

  const branchId = branches.find((b) => b.id === params.branch)?.id ?? branches[0]!.id;
  const shiftCode = params.shift ? parseShiftCode(params.shift) : suggestShiftCode();
  const businessDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : defaultBusinessDateISO(shiftCode);

  const view = await getShiftAccount(branchId, businessDate, shiftCode);
  const canSave = ["owner", "manager", "accountant"].includes(tenant.role);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/sessions"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="size-4" /> Back to till sessions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Final shift accounting</h1>
      </div>

      <form
        method="get"
        className="border-border bg-card grid gap-3 rounded-lg border p-4 sm:grid-cols-4 sm:items-end"
      >
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Branch
          </span>
          <select
            name="branch"
            defaultValue={branchId}
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Date
          </span>
          <input
            type="date"
            name="date"
            defaultValue={businessDate}
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Shift
          </span>
          <ShiftSelect name="shift" defaultValue={shiftCode} />
        </label>
        <button
          type="submit"
          className="bg-primary text-primary-foreground h-10 rounded-md px-4 text-sm font-medium"
        >
          Show shift
        </button>
      </form>

      {!view || view.tills.length === 0 ? (
        <p className="text-muted-foreground border-border bg-card rounded-lg border p-6 text-center text-sm">
          No tills for {SHIFT_LABELS[shiftCode]} on {businessDate}.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={view.open_till_count > 0 ? "default" : "secondary"}>
              {view.closed_till_count} closed · {view.open_till_count} still open
            </Badge>
            {view.saved?.status === "finalised" ? (
              <Badge variant="outline">Saved {view.saved.finalised_at?.slice(0, 10)}</Badge>
            ) : null}
          </div>

          <section className="space-y-2">
            <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
              Each till
            </h2>
            <div className="border-border bg-card overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Till / cashier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Receipts</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Expected cash</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.tills.map((till) => {
                    const variance = till.session.cash_difference;
                    return (
                      <TableRow key={till.session.id}>
                        <TableCell className="text-xs">
                          <div className="font-medium">
                            {formatTillLabel(till.session.till_number)}
                          </div>
                          <div className="text-muted-foreground text-[11px]">
                            {till.session.cashier_label}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={till.session.status === "open" ? "default" : "secondary"}
                            className="capitalize"
                          >
                            {till.session.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {till.totals.sales_count}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatEuro(till.totals.gross)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatEuro(till.totals.vat)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatEuro(till.cash_running.expected)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {till.session.counted_cash != null
                            ? formatEuro(till.session.counted_cash)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {variance != null ? formatEuro(variance) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/sessions/${till.session.id}`}
                            className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                          >
                            Till report <ArrowRight className="size-3" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="border-border bg-card space-y-3 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">
              {SHIFT_LABELS[shiftCode]} total · {businessDate}
            </h2>
            <div className="grid gap-2 sm:grid-cols-4">
              <Stat label="Receipts" value={String(view.combined.sales_count)} />
              <Stat label="Sales" value={formatEuro(view.combined.gross)} />
              <Stat label="Net of VAT" value={formatEuro(view.combined.net)} />
              <Stat label="VAT" value={formatEuro(view.combined.vat)} />
              <Stat label="Expected cash" value={formatEuro(view.combined.cash_expected)} />
              <Stat
                label="Counted cash"
                value={
                  view.combined.cash_counted != null
                    ? formatEuro(view.combined.cash_counted)
                    : "Tills still open"
                }
              />
              <Stat
                label="Cash variance"
                value={
                  view.combined.cash_difference != null
                    ? formatEuro(view.combined.cash_difference)
                    : "—"
                }
              />
              <Stat label="Discounts" value={formatEuro(view.combined.discount)} />
            </div>
            {view.combined.payments.length > 0 ? (
              <div className="text-sm">
                <p className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">
                  Payments (all tills)
                </p>
                <ul className="space-y-1 font-mono text-xs">
                  {view.combined.payments.map((p) => (
                    <li key={p.method} className="flex justify-between">
                      <span className="capitalize">{p.method.replace("_", " ")}</span>
                      <span>
                        {p.count} · {formatEuro(p.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {canSave ? (
              <SaveShiftAccountForm
                branchId={branchId}
                businessDate={businessDate}
                shiftCode={shiftCode}
                alreadySaved={view.saved?.status === "finalised"}
              />
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border rounded border p-2">
      <div className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
