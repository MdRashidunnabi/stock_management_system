import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Truck } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { getPurchaseOrder } from "@/lib/purchasing/orders/actions";
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
import { PurchaseOrderActions } from "@/components/purchasing/purchase-order-actions";
import type { PurchaseOrderStatus } from "@/lib/purchasing/schemas";

export const metadata = { title: "Purchase order · ShopOS" };

type Params = Promise<{ id: string }>;

export default async function PurchaseOrderDetailPage({ params }: { params: Params }) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const { id } = await params;
  const po = await getPurchaseOrder(id);
  if (!po) notFound();

  const canTransition = ["owner", "manager", "warehouse"].includes(tenant.role);
  const canReceive =
    canTransition &&
    (po.status === "submitted" || po.status === "partially_received" || po.status === "draft");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/purchase-orders"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-3" /> Purchase orders
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{po.po_number}</h1>
            <p className="text-muted-foreground text-sm">
              Created {formatDateTimeIE(po.created_at)}
              {po.ordered_at ? ` · Ordered ${formatDateTimeIE(po.ordered_at)}` : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={po.status} />
            {canReceive ? (
              <Link
                href={`/goods-receipts/new?po=${po.id}`}
                className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
              >
                <Truck className="size-4" /> Receive goods
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Supplier" value={po.supplier?.name ?? "-"} />
        <SummaryTile
          label="Branch"
          value={po.branch ? `${po.branch.code} · ${po.branch.name}` : "-"}
        />
        <SummaryTile label="Expected" value={po.expected_at ?? "-"} />
        <SummaryTile label="Lines" value={String(po.items_count)} />
      </div>

      <section className="border-border bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Ordered</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="text-right">Unit cost</TableHead>
              <TableHead>VAT</TableHead>
              <TableHead className="text-right">Line subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {po.items.map((it) => (
              <TableRow key={it.id} className="hover:bg-muted/40">
                <TableCell className="text-xs">
                  <div className="font-medium">{it.product_name}</div>
                  {it.product_sku ? (
                    <div className="text-muted-foreground font-mono">{it.product_sku}</div>
                  ) : null}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">{it.quantity}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {it.qty_received > 0 ? (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {it.qty_received}
                    </span>
                  ) : (
                    "0"
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {it.qty_outstanding > 0 ? (
                    <span className="text-amber-700 dark:text-amber-400">{it.qty_outstanding}</span>
                  ) : (
                    "0"
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatEuro(it.unit_cost)}
                </TableCell>
                <TableCell className="text-xs">{it.vat_code}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatEuro(it.line_subtotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="bg-muted/20 border-border flex flex-col items-end gap-1 border-t px-4 py-3 text-sm">
          <Row label="Subtotal" value={formatEuro(po.subtotal)} />
          <Row label="VAT" value={formatEuro(po.vat_total)} />
          <Row label="Total" value={formatEuro(po.total)} bold />
        </div>
      </section>

      {po.notes ? (
        <section className="border-border bg-card rounded-lg border p-4">
          <h2 className="mb-1 text-sm font-medium">Notes</h2>
          <p className="text-muted-foreground text-sm whitespace-pre-line">{po.notes}</p>
        </section>
      ) : null}

      {canTransition ? <PurchaseOrderActions poId={po.id} status={po.status} /> : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href="/goods-receipts"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          See goods receipts <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const variant: Record<PurchaseOrderStatus, "default" | "secondary" | "destructive" | "outline"> =
    {
      draft: "outline",
      submitted: "secondary",
      partially_received: "default",
      received: "default",
      cancelled: "destructive",
      closed: "secondary",
    };
  const label = status === "submitted" ? "ordered" : status.replace("_", " ");
  return (
    <Badge variant={variant[status]} className="text-xs capitalize">
      {label}
    </Badge>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-card rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex w-64 justify-between">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "font-mono font-semibold" : "font-mono"}>{value}</span>
    </div>
  );
}
