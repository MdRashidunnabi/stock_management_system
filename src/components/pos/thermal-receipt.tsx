import type { SaleFullRow } from "@/lib/pos/schemas";
import { formatEuro } from "@/lib/utils";
import { formatVatPercent } from "@/lib/pos/vat-display";
import { formatTillLabel } from "@/lib/pos/shifts";
import { ReceiptPrintButton } from "@/components/pos/receipt-print-button";

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

/**
 * 80mm thermal till slip: narrow, long, VAT on every line then a final VAT total.
 */
export function ThermalReceipt({ shopName, sale }: { shopName: string; sale: SaleFullRow }) {
  return (
    <>
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 3mm; }
          html, body { background: #fff !important; }
          body * { visibility: hidden; }
          #receipt-thermal, #receipt-thermal * { visibility: visible; }
          #receipt-thermal {
            position: absolute;
            left: 0;
            top: 0;
            width: 74mm;
            max-width: 74mm;
            margin: 0;
            padding: 0;
            border: 0;
            box-shadow: none;
            background: #fff;
            color: #000;
          }
        }
      `}</style>
      <div className="flex items-center justify-end print:hidden">
        <ReceiptPrintButton />
      </div>
      <div
        id="receipt-thermal"
        className="border-border bg-card mx-auto w-full max-w-[80mm] space-y-2 rounded-lg border p-3 font-mono text-[11px] leading-tight text-black print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        <header className="space-y-0.5 text-center">
          <h1 className="text-sm font-bold tracking-wide uppercase">{shopName}</h1>
          {sale.branch ? (
            <p>
              {sale.branch.code} · {sale.branch.name}
            </p>
          ) : null}
          {sale.till_number ? <p>{formatTillLabel(sale.till_number)}</p> : null}
          <p className="text-xs font-semibold">{sale.receipt_number}</p>
          <p>{formatReceiptWhen(sale.created_at)}</p>
        </header>

        <div className="border-border border-t border-dashed" />

        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left">
              <th className="pb-1 font-normal">Item</th>
              <th className="pb-1 text-right font-normal">EUR</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((it) => (
              <tr key={it.id} className="align-top">
                <td className="py-1.5 pr-1">
                  <div className="font-semibold whitespace-normal">{it.name_snapshot}</div>
                  <div>
                    {formatQty(it.quantity)} × {formatEuro(it.unit_price)}
                    {it.discount > 0 ? ` − ${formatEuro(it.discount)}` : ""}
                  </div>
                  <div>
                    VAT {it.vat_code} {formatVatPercent(it.vat_rate)} {formatEuro(it.line_vat)}
                  </div>
                </td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  {formatEuro(it.line_total_gross)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-border border-t border-dashed" />

        <div className="space-y-0.5">
          <Row label="Net" value={formatEuro(sale.subtotal)} />
          {sale.discount_total > 0 ? (
            <Row label="Discount" value={`− ${formatEuro(sale.discount_total)}`} />
          ) : null}
          <Row label="VAT" value={formatEuro(sale.vat_total)} />
          {sale.rounding ? <Row label="Rounding" value={formatEuro(sale.rounding)} /> : null}
          <div className="flex items-center justify-between border-t border-dashed pt-1 text-sm font-bold">
            <span>TOTAL</span>
            <span>{formatEuro(sale.total)}</span>
          </div>
        </div>

        <div className="space-y-0.5">
          <p className="font-semibold tracking-wide">VAT BY ITEM RATE</p>
          {vatLines(sale).map((row) => (
            <div key={row.code} className="flex justify-between">
              <span>
                {row.code} {formatVatPercent(row.rate)}
              </span>
              <span>
                net {formatEuro(row.base)} vat {formatEuro(row.vat)}
              </span>
            </div>
          ))}
          <div className="flex justify-between font-semibold">
            <span>Total VAT</span>
            <span>{formatEuro(sale.vat_total)}</span>
          </div>
        </div>

        <div className="border-border border-t border-dashed" />

        <div className="space-y-0.5">
          {sale.payments.map((p) => (
            <Row
              key={p.id}
              label={
                (PAYMENT_LABEL[p.method] ?? p.method) + (p.card_last4 ? ` ****${p.card_last4}` : "")
              }
              value={formatEuro(p.amount)}
            />
          ))}
        </div>

        {sale.customer ? <p>Customer: {sale.customer.full_name}</p> : null}

        <p className="pt-2 text-center">Thank you. Keep this slip for returns.</p>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="whitespace-nowrap">{value}</span>
    </div>
  );
}

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatReceiptWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function vatLines(
  sale: SaleFullRow,
): Array<{ code: string; rate: number; base: number; vat: number }> {
  const entries = Object.entries(sale.vat_breakdown);
  if (entries.length > 0) {
    return entries.map(([code, v]) => ({
      code,
      rate: v.rate,
      base: v.base,
      vat: v.vat,
    }));
  }
  const map = new Map<string, { code: string; rate: number; base: number; vat: number }>();
  for (const it of sale.items) {
    const cur = map.get(it.vat_code) ?? {
      code: it.vat_code,
      rate: it.vat_rate,
      base: 0,
      vat: 0,
    };
    cur.base += it.line_total_net;
    cur.vat += it.line_vat;
    map.set(it.vat_code, cur);
  }
  return Array.from(map.values());
}
