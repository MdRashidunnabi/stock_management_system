import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FilePlus2, Truck } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { listPurchaseOrders } from "@/lib/purchasing/orders/actions";
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
import type { PurchaseOrderStatus } from "@/lib/purchasing/schemas";

export const metadata = { title: "Purchase orders · ShopOS" };

export default async function PurchaseOrdersPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const orders = await listPurchaseOrders(150);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Purchase orders</h1>
          <p className="text-muted-foreground text-sm">
            Order stock from your suppliers. When the goods arrive, log a goods receipt to update
            inventory and the weighted-average cost.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/goods-receipts"
            className="border-input bg-background hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
          >
            <Truck className="size-4" /> Goods receipts
          </Link>
          <Link
            href="/purchase-orders/new"
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
          >
            <FilePlus2 className="size-4" /> New purchase order
          </Link>
        </div>
      </div>

      <div className="border-border bg-card overflow-x-auto rounded-lg border">
        {orders.length === 0 ? (
          <div className="space-y-2 p-10 text-center">
            <p className="text-muted-foreground text-sm">
              No purchase orders yet. Create your first one to track stock arriving from suppliers.
            </p>
            <Link
              href="/purchase-orders/new"
              className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
            >
              Create a purchase order <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead className="text-right">Lines</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((po) => (
                <TableRow key={po.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {po.po_number}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={po.status} />
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {po.supplier?.name ?? "-"}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {po.branch ? `${po.branch.code} · ${po.branch.name}` : "-"}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatDateTimeIE(po.created_at)}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {po.expected_at ?? "-"}
                  </TableCell>
                  <TableCell className="text-right text-xs">{po.items_count}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatEuro(po.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/purchase-orders/${po.id}`}
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
    <Badge variant={variant[status]} className="capitalize">
      {label}
    </Badge>
  );
}
