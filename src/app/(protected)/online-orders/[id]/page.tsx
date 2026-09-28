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
import { fulfillmentStageLabel, lineStatusLabel } from "@/lib/storefront/fulfillment";

export const metadata: Metadata = { title: "Online order" };

export default async function OnlineOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["owner", "manager", "warehouse", "delivery"]);
  const { id } = await params;
  const detail = await getOnlineOrderDetail(id);
  if (!detail) notFound();

  const { order, items, payment } = detail;
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

            <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Products</dt>
                <dd className="font-mono">{formatEuro(order.products_total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="font-mono">{formatEuro(order.delivery_fee)}</dd>
              </div>
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
          <h2 className="text-sm font-semibold">Tracking</h2>
          <FulfillmentStepper
            orderId={order.id}
            fulfillmentType={order.fulfillment_type}
            stage={String(order.fulfillment_stage)}
            disabled={cancelled}
          />
        </aside>
      </div>
    </div>
  );
}
