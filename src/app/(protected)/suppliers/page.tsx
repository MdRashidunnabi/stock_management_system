import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listSuppliers } from "@/lib/suppliers/actions";
import { requireTenant } from "@/lib/auth/tenant";

export const metadata = { title: "Suppliers - ShopOS" };

export default async function SuppliersPage() {
  const tenant = await requireTenant();
  const suppliers = await listSuppliers();
  const canWrite = ["owner", "manager", "warehouse"].includes(tenant.role);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground text-sm">
            People and companies you buy stock from. Used on purchase orders and goods receipts.
          </p>
        </div>
        {canWrite ? (
          <Button asChild>
            <Link href="/suppliers/new">
              <Plus className="size-4" />
              New supplier
            </Link>
          </Button>
        ) : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>All suppliers ({suppliers.length})</CardTitle>
          <CardDescription>
            Click a supplier to edit. Archived suppliers cannot be used on new purchase orders but
            stay available for historical records.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {suppliers.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">
              No suppliers yet. Add your first one with the button above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-center">Lead</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs">
                      {s.code ? (
                        <Link href={`/suppliers/${s.id}`} className="hover:underline">
                          {s.code}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/suppliers/${s.id}`} className="hover:underline">
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>
                        {s.contact_name ?? <span className="text-muted-foreground">-</span>}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {s.email ?? s.phone ?? ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {[s.city, s.county, s.country].filter(Boolean).join(", ") || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.payment_terms ?? <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {s.default_lead_time_days ?? <span className="text-muted-foreground">-</span>}
                      d
                    </TableCell>
                    <TableCell className="text-center">
                      {s.is_active ? (
                        <Badge>Active</Badge>
                      ) : (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
