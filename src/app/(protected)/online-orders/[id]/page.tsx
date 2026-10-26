import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/tenant";
import { getOnlineOrderDetail, listSubstituteCandidates } from "@/lib/storefront/admin-queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEuro, formatDateTimeIE } from "@/lib/utils";
import { FulfillmentStepper } from "@/components/online-orders/fulfillment-stepper";
import { LineResolveControls } from "@/components/online-orders/line-resolve-controls";
import { PrintInvoiceButton } from "@/components/online-orders/print-invoice-button";
import { RefundCardButton } from "@/components/online-orders/refund-card-button";
import { VoucherIssuePanel } from "@/components/online-orders/voucher-issue-panel";
import { getOnlineOrderVoucher } from "@/lib/vouchers/admin";
import { fulfillmentStageLabel, lineStatusLabel } from "@/lib/storefront/fulfillment";
import { AutoPrint } from "@/components/pos/auto-print";
import { code39Svg } from "@/lib/vouchers/code39";
import { parseVoucherNote } from "@/lib/vouchers/note";

export const metadata: Metadata = { title: "Online order" };

export default async function OnlineOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  await requireRole(["owner", "manager", "cashier", "warehouse", "delivery"]);
  const { id } = await params;
  const sp = await searchParams;
  const printNow = sp.print === "1";
  const [detail, voucher] = await Promise.all([
    getOnlineOrderDetail(id),
    getOnlineOrderVoucher(id),
  ]);
  if (!detail) notFound();

  const { order, items, payment } = detail;
  const slip = parseVoucherNote(order.notes);
  const cancelled = order.status === "cancelled";
  const candidatesByLine = await Promise.all(
    items.map((line) =>
      line.line_status === "ok"
        ? listSubstituteCandidates(line.product_id, line.category_id, order.branch_id)
        : Promise.resolve([]),
    ),
  );

  return (
    <div className="space-y-6">
      <AutoPrint enabled={printNow} />
      <p className="text-sm font-semibold">Order {order.order_number}</p>
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Link
            href="/online-orders"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" /> All online orders
          </Link>
          <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight">
            {order.order_number}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {formatDateTimeIE(order.created_at)}
            {order.is_advance && order.wanted_for_date ? ` · wanted ${order.wanted_for_date}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {order.sale_id ? (
            <Button variant="outline" asChild>
              <Link href={`/sales/${order.sale_id}`}>Till receipt</Link>
            </Button>
          ) : null}
          <PrintInvoiceButton />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-6">
          <section className="border-border bg-card rounded-xl border p-5">
            <h2 className="text-sm font-semibold tracking-wide uppercase">Invoice</h2>
            <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Customer</span>
                <br />
                {order.customer_name}
                <br />
                {order.customer_phone}
                {order.customer_email ? (
                  <>
                    <br />
                    {order.customer_email}
                  </>
                ) : null}
              </p>
              <p>
                <span className="text-muted-foreground">Fulfilment</span>
                <br />
                {order.fulfillment_type === "takeaway" ? "Collection" : "Delivery"}
                <br />
                {order.delivery_address}
                {order.pickup_at ? (
                  <>
                    <br />
                    Collect {formatDateTimeIE(order.pickup_at)}
                  </>
                ) : null}
              </p>
            </div>
            {order.notes ? (
              <p className="text-muted-foreground mt-3 text-sm">Note: {order.notes}</p>
            ) : null}

            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((line, i) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div className="font-medium">{line.name}</div>
                        {line.original_name ? (
                          <div className="text-muted-foreground text-xs">
                            Replaced {line.original_name}
                          </div>
                        ) : null}
                        {line.line_status === "ok" ? (
                          <div className="mt-2">
                            <LineResolveControls
                              orderId={order.id}
                              itemId={line.id}
                              policy={line.unavailable_policy}
                              candidates={candidatesByLine[i] ?? []}
                            />
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{line.sku ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{line.barcode ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{line.quantity}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatEuro(line.line_total)}
                        {line.refunded_amount > 0 ? (
                          <div className="text-muted-foreground text-xs">
                            Refund {formatEuro(line.refunded_amount)}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs">{lineStatusLabel(line.line_status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {items.length === 0 && voucher && voucher.externalItems.length > 0 ? (
              <ul className="mt-4 space-y-1 text-sm">
                {voucher.externalItems.map((line, i) => (
                  <li key={`${line.name}-${i}`} className="flex justify-between gap-3">
                    <span>
                      {line.name} × {line.qty}
                    </span>
                    <span className="font-mono">
                      {formatEuro(Number(line.qty ?? 0) * Number(line.unitPrice ?? 0))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Products</dt>
                <dd className="font-mono">{formatEuro(order.products_total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="font-mono">{formatEuro(order.delivery_fee)}</dd>
              </div>
              {voucher && voucher.discount > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Voucher</dt>
                  <dd className="font-mono">−{formatEuro(voucher.discount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t pt-1 font-semibold">
                <dt>Total</dt>
                <dd className="font-mono">{formatEuro(order.total)}</dd>
              </div>
              {payment ? (
                <div className="text-muted-foreground flex justify-between text-xs">
                  <dt>
                    {payment.method} · {payment.status}
                  </dt>
                  <dd>
                    {payment.refunded_amount > 0
                      ? `Refunded ${formatEuro(payment.refunded_amount)}`
                      : null}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        </div>

        <aside className="border-border bg-card h-fit space-y-4 rounded-xl border p-5 print:hidden">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="capitalize">
              {order.status}
            </Badge>
            <Badge>{fulfillmentStageLabel(order.fulfillment_stage)}</Badge>
            {order.is_advance ? <Badge variant="secondary">Advance</Badge> : null}
          </div>
          <VoucherIssuePanel orderId={order.id} voucher={voucher} cancelled={cancelled} />
          {payment &&
          payment.method === "card" &&
          payment.status !== "refunded" &&
          payment.amount - payment.refunded_amount > 0.009 ? (
            <RefundCardButton
              orderId={order.id}
              amount={Math.round((payment.amount - payment.refunded_amount) * 100) / 100}
            />
          ) : null}
          <h2 className="text-sm font-semibold">Tracking</h2>
          <FulfillmentStepper
            orderId={order.id}
            fulfillmentType={order.fulfillment_type}
            stage={String(order.fulfillment_stage)}
            disabled={cancelled}
          />
        </aside>
      </div>
      {slip?.code ? (
        <section className="mx-auto max-w-sm space-y-2 border border-dashed p-4 text-center font-mono text-sm">
          <p className="font-bold">VOUCHER {formatEuro(slip.amount)}</p>
          <div
            className="[&_svg]:mx-auto [&_svg]:h-16 [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: code39Svg(slip.code, 70) }}
          />
          <p className="text-base font-bold tracking-[0.2em]">{slip.code}</p>
          <p>Order {order.order_number}</p>
          <p>Valid until {slip.expires}</p>
        </section>
      ) : null}
      <div className="print:hidden">
        <Button asChild variant="outline">
          <Link href={`/online-orders/${order.id}?print=1`}>Print receipt and voucher</Link>
        </Button>
      </div>
    </div>
  );
}
