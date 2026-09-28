import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Globe } from "lucide-react";
import { hasRole, requireRole } from "@/lib/auth/tenant";
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
import { fulfillmentStageLabel } from "@/lib/storefront/fulfillment";

export const metadata: Metadata = {
  title: "Online orders",
};

export default async function OnlineOrdersPage() {
  const tenant = await requireRole(["owner", "manager", "warehouse", "delivery"]);
  const orders = await listOnlineOrdersForTenant();
  const shopUrl = `/shop/${tenant.tenantSlug}`;
  const canEditStorefront = await hasRole(["owner", "manager", "super_admin"]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-guide="online-orders">
            Online orders
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Invoice, substitutes, refunds, and delivery or collection tracking.
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Tracking</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground py-8 text-center text-sm">
                No online orders yet.
              </TableCell>
            </TableRow>
          ) : (
            orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/online-orders/${o.id}`} className="text-primary hover:underline">
                    {o.order_number}
                  </Link>
                  {o.is_advance ? (
                    <div className="text-muted-foreground mt-0.5">
                      Advance{o.wanted_for_date ? ` · ${o.wanted_for_date}` : ""}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{o.customer_name}</div>
                  <div className="text-muted-foreground text-xs">{o.customer_phone}</div>
                </TableCell>
                <TableCell className="text-xs capitalize">
                  {o.fulfillment_type === "takeaway" ? "Collection" : "Delivery"}
                  {o.pickup_at && o.fulfillment_type === "takeaway" ? (
                    <div className="text-muted-foreground">
                      {new Date(o.pickup_at).toLocaleString("en-IE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{fulfillmentStageLabel(o.fulfillment_stage)}</Badge>
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
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
