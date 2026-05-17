import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { getSale } from "@/lib/pos/actions";
import { Badge } from "@/components/ui/badge";
import { ReceiptPrintButton } from "@/components/pos/receipt-print-button";
import { formatDateTimeIE, formatEuro } from "@/lib/utils";

export const metadata = {
  title: "Receipt · ShopOS",
};

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

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const sale = await getSale(id);
  if (!sale) notFound();

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/sales"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="size-4" /> Back to sales
        </Link>
        <ReceiptPrintButton />
      </div>

      <div
        className="border-border bg-card mx-auto max-w-2xl space-y-4 rounded-lg border p-6 text-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
        id="receipt"
      >
        {/* Header */}
        <header className="space-y-1 text-center">
          <h1 className="text-lg font-semibold">{tenant.tenantName}</h1>
          {sale.branch ? (
            <p className="text-muted-foreground text-xs">
              {sale.branch.code} · {sale.branch.name}
            </p>
          ) : null}
          <p className="font-mono text-base">{sale.receipt_number}</p>
          <p className="text-muted-foreground text-xs">{formatDateTimeIE(sale.created_at)}</p>
          {sale.status !== "completed" ? (
            <Badge variant="outline" className="uppercase">
              {sale.status}
            </Badge>
          ) : null}
        </header>

        <hr className="border-border border-dashed" />

        {/* Items */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs uppercase">
              <th className="py-1">Item</th>
              <th className="py-1 text-right">Qty</th>
              <th className="py-1 text-right">Unit</th>
              <th className="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {sale.items.map((it) => (
              <tr key={it.id} className="align-top">
                <td className="py-2 pr-2">
                  <div className="font-medium">{it.name_snapshot}</div>
                  <div className="text-muted-foreground font-mono text-[11px]">
                    {it.sku_snapshot ?? "-"}{" "}
                    <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">
                      {it.vat_code} {(it.vat_rate * 100).toFixed(it.vat_rate < 0.1 ? 1 : 0)}%
                    </Badge>
                  </div>
                  {it.discount > 0 ? (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      - {formatEuro(it.discount)} off
                    </div>
                  ) : null}
                </td>
                <td className="py-2 text-right font-mono">{it.quantity}</td>
                <td className="py-2 text-right font-mono">{formatEuro(it.unit_price)}</td>
                <td className="py-2 text-right font-mono">{formatEuro(it.line_total_gross)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <hr className="border-border border-dashed" />

        {/* Totals */}
        <div className="space-y-1 font-mono text-sm">
          <Row label="Subtotal (net)" value={formatEuro(sale.subtotal)} />
          {sale.discount_total > 0 ? (
            <Row label="Discount" value={`- ${formatEuro(sale.discount_total)}`} />
          ) : null}
          <Row label="VAT" value={formatEuro(sale.vat_total)} />
          {sale.rounding ? <Row label="Rounding" value={formatEuro(sale.rounding)} /> : null}
          <div className="flex items-center justify-between border-t border-dashed pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatEuro(sale.total)}</span>
          </div>
        </div>

        {/* VAT breakdown */}
        {Object.keys(sale.vat_breakdown).length > 0 ? (
          <div className="text-muted-foreground space-y-1 text-xs">
            <p className="font-semibold tracking-wide uppercase">VAT breakdown</p>
            {Object.entries(sale.vat_breakdown).map(([code, v]) => (
              <div key={code} className="flex items-center justify-between font-mono">
                <span>
                  {code} @ {(v.rate * 100).toFixed(v.rate < 0.1 ? 1 : 0)}%
                </span>
                <span>
                  base {formatEuro(v.base)} · vat {formatEuro(v.vat)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <hr className="border-border border-dashed" />

        {/* Payments */}
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Payments ({sale.payments.length})
          </p>
          {sale.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between font-mono">
              <span>
                {PAYMENT_LABEL[p.method] ?? p.method}
                {p.card_last4 ? ` · ****${p.card_last4}` : ""}
                {p.external_ref ? ` · ${p.external_ref}` : ""}
              </span>
              <span>{formatEuro(p.amount)}</span>
            </div>
          ))}
        </div>

        {sale.customer ? (
          <p className="text-muted-foreground text-xs">
            Customer: {sale.customer.full_name}
            {sale.customer.email ? ` · ${sale.customer.email}` : ""}
          </p>
        ) : null}

        {sale.notes ? <p className="text-muted-foreground text-xs italic">{sale.notes}</p> : null}

        <p className="text-muted-foreground pt-2 text-center text-[11px]">
          Thanks for shopping with us. Keep this receipt for refunds & exchanges.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
