import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Truck } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { listGoodsReceipts } from "@/lib/purchasing/receipts/actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeIE, formatEuro } from "@/lib/utils";
import type { GoodsReceiptStatus } from "@/lib/purchasing/schemas";

export const metadata = { title: "Goods receipts · ShopOS" };

export default async function GoodsReceiptsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const receipts = await listGoodsReceipts(150);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Goods receipts</h1>
          <p className="text-muted-foreground text-sm">
            Each receipt records what actually arrived from a supplier. Finalising a receipt updates
            stock balances and the weighted-average product cost.
          </p>
        </div>
        <Link
          href="/goods-receipts/new"
          className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
        >
          <Truck className="size-4" /> New goods receipt
        </Link>
      </div>

      <div className="border-border bg-card overflow-x-auto rounded-lg border">
        {receipts.length === 0 ? (
          <div className="space-y-2 p-10 text-center">
            <p className="text-muted-foreground text-sm">
              No goods receipts yet. When supplier deliveries arrive, log them here.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GR #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="text-right">Lines</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((gr) => (
                <TableRow key={gr.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {gr.gr_number}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={gr.status} />
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {gr.supplier?.name ?? "-"}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {gr.branch ? `${gr.branch.code} · ${gr.branch.name}` : "-"}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatDateTimeIE(gr.received_at)}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {gr.po_number ? (
                      <Link
                        className="text-primary hover:underline"
                        href={`/purchase-orders/${gr.purchase_order_id}`}
                      >
                        {gr.po_number}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {gr.invoice_number ? (
                      <span>
                        <span className="font-mono">{gr.invoice_number}</span>
                        {gr.invoice_total != null ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {formatEuro(gr.invoice_total)}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs">{gr.items_count}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/goods-receipts/${gr.id}`}
                      className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                    >
                      Open <ArrowRight className="size-3" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
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
    <Badge variant={variant[status]} className="capitalize">
      {status}
    </Badge>
  );
}
