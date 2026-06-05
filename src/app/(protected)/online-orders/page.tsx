import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Globe } from "lucide-react";
import { hasRole, requireTenant } from "@/lib/auth/tenant";
import { listOnlineOrdersForTenant } from "@/lib/storefront/admin-queries";
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
import { formatEuro } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Online orders",
};

export default async function OnlineOrdersPage() {
  const tenant = await requireTenant();
  const orders = await listOnlineOrdersForTenant();
  const shopUrl = `/shop/${tenant.tenantSlug}`;
  const canEditStorefront = await hasRole(["owner", "manager", "super_admin"]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Online orders</h1>
          <p className="text-muted-foreground text-sm">
            Orders from your public shop share the same stock as POS.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditStorefront ? (
            <Button variant="secondary" asChild>
              <Link href="/settings/storefront">Shop settings</Link>
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link href={shopUrl} target="_blank" rel="noopener noreferrer">
              <Globe className="size-4" />
              View shop
              <ExternalLink className="size-3" />
            </Link>
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs">
        Your store URL:{" "}
        <Link href={shopUrl} className="text-success font-medium underline">
          {shopUrl}
        </Link>
        — created automatically when you onboard. Products and stock come from this app.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Date</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground py-8 text-center text-sm">
                No online orders yet.
              </TableCell>
            </TableRow>
          ) : (
            orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{o.customer_name}</div>
                  <div className="text-muted-foreground text-xs">{o.customer_phone}</div>
                </TableCell>
                <TableCell className="text-xs capitalize">
                  {o.fulfillment_type}
                  {o.pickup_at && o.fulfillment_type === "takeaway" ? (
                    <div className="text-muted-foreground">
                      {new Date(o.pickup_at).toLocaleString("en-IE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-xs capitalize">
                  {o.payment_method === "online_card" ? "Online card" : "COD"}
                  <div className="text-muted-foreground">
                    <Badge
                      variant={o.status === "pending" ? "secondary" : "outline"}
                      className="mt-0.5"
                    >
                      {o.status}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  <div>{formatEuro(o.total)}</div>
                  {o.delivery_fee > 0 ? (
                    <div className="text-muted-foreground text-xs">
                      incl. {formatEuro(o.delivery_fee)} delivery
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {new Date(o.created_at).toLocaleString("en-IE")}
                </TableCell>
                <TableCell>
                  {o.sale_id ? (
                    <Link href={`/sales/${o.sale_id}`} className="text-success text-xs underline">
                      Sale
                    </Link>
                  ) : null}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
