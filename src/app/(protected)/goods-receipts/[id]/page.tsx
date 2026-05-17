import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { getGoodsReceipt } from "@/lib/purchasing/receipts/actions";
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
import { GoodsReceiptFinaliseButton } from "@/components/purchasing/goods-receipt-finalise-button";
import type { GoodsReceiptStatus } from "@/lib/purchasing/schemas";

export const metadata = { title: "Goods receipt · ShopOS" };

type Params = Promise<{ id: string }>;

export default async function GoodsReceiptDetailPage({ params }: { params: Params }) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const { id } = await params;
  const gr = await getGoodsReceipt(id);
  if (!gr) notFound();

  const canFinalise =
    ["owner", "manager", "warehouse"].includes(tenant.role) && gr.status === "draft";

  const totalCost =
    Math.round(gr.items.reduce((sum, it) => sum + it.quantity * it.unit_cost, 0) * 100) / 100;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/goods-receipts"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-3" /> Goods receipts
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{gr.gr_number}</h1>
            <p className="text-muted-foreground text-sm">
              Received {formatDateTimeIE(gr.received_at)}
              {gr.finalised_at ? ` · Finalised ${formatDateTimeIE(gr.finalised_at)}` : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={gr.status} />
            {canFinalise ? <GoodsReceiptFinaliseButton grId={gr.id} /> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Supplier" value={gr.supplier?.name ?? "-"} />
        <SummaryTile
          label="Branch"
          value={gr.branch ? `${gr.branch.code} · ${gr.branch.name}` : "-"}
        />
        <SummaryTile
          label="Linked PO"
          value={
            gr.po_number ? (
              <Link
                href={`/purchase-orders/${gr.purchase_order_id}`}
                className="text-primary font-mono hover:underline"
              >
                {gr.po_number}
              </Link>
            ) : (
              "-"
            )
          }
        />
        <SummaryTile
          label="Invoice"
          value={
            gr.invoice_number
              ? `${gr.invoice_number}${gr.invoice_total != null ? ` · ${formatEuro(gr.invoice_total)}` : ""}`
              : "-"
          }
        />
      </div>

      <section className="border-border bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit cost</TableHead>
              <TableHead>VAT</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Lot #</TableHead>
              <TableHead className="text-right">Line cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gr.items.map((it) => (
              <TableRow key={it.id} className="hover:bg-muted/40">
                <TableCell className="text-xs">
                  <div className="font-medium">{it.product_name}</div>
                  {it.product_sku ? (
                    <div className="text-muted-foreground font-mono">{it.product_sku}</div>
                  ) : null}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">{it.quantity}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatEuro(it.unit_cost)}
                </TableCell>
                <TableCell className="text-xs">{it.vat_code}</TableCell>
                <TableCell className="text-xs">{it.expiry_date ?? "-"}</TableCell>
                <TableCell className="font-mono text-xs">{it.lot_no ?? "-"}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatEuro(it.quantity * it.unit_cost)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="bg-muted/20 border-border flex items-center justify-end gap-6 border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">Total cost (net of VAT)</span>
          <span className="font-mono font-semibold">{formatEuro(totalCost)}</span>
        </div>
      </section>

      {gr.notes ? (
        <section className="border-border bg-card rounded-lg border p-4">
          <h2 className="mb-1 text-sm font-medium">Notes</h2>
          <p className="text-muted-foreground text-sm whitespace-pre-line">{gr.notes}</p>
        </section>
      ) : null}

      {gr.status === "draft" ? (
        <section className="border-border bg-muted/30 rounded-lg border p-4 text-sm">
          <p className="font-medium">Finalising will:</p>
          <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1 text-xs">
            <li>Increase stock at this branch by the quantities above.</li>
            <li>
              Update each product&apos;s purchase price using a weighted-average cost formula.
            </li>
            <li>
              Increment matching purchase order lines and roll the PO status to{" "}
              <span className="font-mono">partially_received</span> or{" "}
              <span className="font-mono">received</span> when applicable.
            </li>
            <li>Lock this receipt — you cannot edit it after finalising.</li>
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: GoodsReceiptStatus }) {
  const variant: Record<GoodsReceiptStatus, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "outline",
    finalised: "default",
    cancelled: "destructive",
  };
  return (
    <Badge variant={variant[status]} className="text-xs capitalize">
      {status}
    </Badge>
  );
}

function SummaryTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-border bg-card rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
