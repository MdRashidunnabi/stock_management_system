import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ScanLine } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { getSessionWithSummary } from "@/lib/pos/sessions/actions";
import { Badge } from "@/components/ui/badge";
import { ZReport } from "@/components/pos/sessions/z-report";
import { CashMovementForm } from "@/components/pos/sessions/cash-movement-form";
import { CloseSessionDialog } from "@/components/pos/sessions/close-session-dialog";
import { ReceiptPrintButton } from "@/components/pos/receipt-print-button";

export const metadata = { title: "Till session · ShopOS" };

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const summary = await getSessionWithSummary(id);
  if (!summary) notFound();

  const isOpen = summary.session.status === "open";

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/sessions"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="size-4" /> Back to till sessions
        </Link>
        <div className="flex items-center gap-2">
          {isOpen ? (
            <Link
              href="/pos"
              className="border-input bg-card hover:bg-accent inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium"
            >
              <ScanLine className="size-3.5" /> Open POS
            </Link>
          ) : null}
          <ReceiptPrintButton />
        </div>
      </div>

      {isOpen ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px] print:grid-cols-1">
          <div>
            <ZReport summary={summary} shopName={tenant.tenantName} />
          </div>

          <aside className="space-y-3 print:hidden">
            <div className="border-border bg-card rounded-lg border p-4">
              <div className="flex items-center gap-2 pb-2">
                <Badge variant="default" className="capitalize">
                  open
                </Badge>
                <span className="text-muted-foreground text-xs">
                  Live X-Report. Refresh after each sale.
                </span>
              </div>
              <h2 className="text-sm font-semibold">Record a cash movement</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Use this for cash drops to the safe, petty expenses, or extra cash added to the
                drawer.
              </p>
              <div className="mt-3">
                <CashMovementForm sessionId={summary.session.id} />
              </div>
            </div>

            <div className="border-border bg-card rounded-lg border p-4">
              <h2 className="text-sm font-semibold">End the shift</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Count the cash in the drawer and close the till. We&apos;ll record the variance.
              </p>
              <div className="mt-3">
                <CloseSessionDialog
                  sessionId={summary.session.id}
                  expectedCash={summary.cash_running.expected}
                />
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <ZReport summary={summary} shopName={tenant.tenantName} />
      )}
    </div>
  );
}
