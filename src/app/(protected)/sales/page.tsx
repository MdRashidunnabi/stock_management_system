import Link from "next/link";
import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { listRecentSales } from "@/lib/pos/actions";
import { listOnlineOrdersForTenant } from "@/lib/storefront/admin-queries";
import { parseVoucherNote } from "@/lib/vouchers/note";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeIE, formatEuro, cn } from "@/lib/utils";

export const metadata = {
  title: "Sales · ShopOS",
};

const CHANNELS = [
  { id: "all", label: "Till + online" },
  { id: "pos", label: "Till" },
  { id: "online", label: "Online" },
] as const;

export default async function SalesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const sp = await searchParams;
  const channel = sp.channel === "pos" || sp.channel === "online" ? sp.channel : "all";
  const sales = await listRecentSales(100, channel === "online" ? "online" : channel);
  const onlineOrders = channel === "pos" ? [] : await listOnlineOrdersForTenant(100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-guide="sales">
            Recent sales
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Same list as reports — filter till or online here, or open Reports for SKU totals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/reports?tab=channels"
            className="border-input bg-card hover:bg-accent inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
          >
            Sales reports
          </Link>
          <Link
            href="/pos"
            className="border-input bg-card hover:bg-accent inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
          >
            <Receipt className="size-4" /> Open POS
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {CHANNELS.map((c) => (
          <Link
            key={c.id}
            href={c.id === "all" ? "/sales" : `/sales?channel=${c.id}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium",
              channel === c.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {onlineOrders.length > 0 ? (
        <div className="border-border bg-card overflow-x-auto rounded-lg border">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Online orders</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order number</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Voucher</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Print</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {onlineOrders.map((order) => {
                const voucher = parseVoucherNote(order.notes);
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono">
                      <Link
                        href={`/online-orders/${order.id}`}
                        className="text-primary hover:underline"
                      >
                        {order.order_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDateTimeIE(order.created_at)}
                    </TableCell>
                    <TableCell className="text-xs">{order.customer_name}</TableCell>
                    <TableCell className="text-xs">
                      {voucher && voucher.amount > 0
                        ? `${formatEuro(voucher.amount)}${voucher.code ? ` · ${voucher.code}` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatEuro(order.total)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/online-orders/${order.id}?print=1`}
                        className="text-primary text-xs hover:underline"
                      >
                        Receipt and voucher
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <div className="border-border bg-card overflow-x-auto rounded-lg border">
        {sales.length === 0 ? (
          <div className="text-muted-foreground p-10 text-center text-sm">
            No sales yet. Head to{" "}
            <Link className="text-primary underline-offset-4 hover:underline" href="/pos">
              the POS
            </Link>{" "}
            to ring up your first one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono">
                    <Link href={`/sales/${s.id}`} className="text-primary hover:underline">
                      {s.receipt_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatDateTimeIE(s.created_at)}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {s.branch ? `${s.branch.code} · ${s.branch.name}` : "-"}
                  </TableCell>
                  <TableCell className="text-xs">{s.customer?.full_name ?? "Walk-in"}</TableCell>
                  <TableCell className="text-xs uppercase">{s.channel}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(s.total)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={s.status === "completed" ? "secondary" : "outline"}
                      className="capitalize"
                    >
                      {s.status}
                    </Badge>
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
