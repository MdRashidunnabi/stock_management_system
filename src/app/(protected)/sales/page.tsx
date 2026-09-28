import Link from "next/link";
import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { listRecentSales } from "@/lib/pos/actions";
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
  const sales = await listRecentSales(100, channel);

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
