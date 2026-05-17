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
import { formatDateTimeIE, formatEuro } from "@/lib/utils";

export const metadata = {
  title: "Sales · ShopOS",
};

export default async function SalesIndexPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const sales = await listRecentSales(100);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recent sales</h1>
          <p className="text-muted-foreground text-sm">
            Last 100 receipts from every branch in your shop.
          </p>
        </div>
        <Link
          href="/pos"
          className="border-input bg-card hover:bg-accent inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
        >
          <Receipt className="size-4" /> Open POS
        </Link>
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
