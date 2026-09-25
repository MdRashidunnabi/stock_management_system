import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { getSale } from "@/lib/pos/actions";
import { Badge } from "@/components/ui/badge";
import { ThermalReceipt } from "@/components/pos/thermal-receipt";

export const metadata = {
  title: "Receipt · ShopOS",
};

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const sale = await getSale(id);
  if (!sale) notFound();

  return (
    <div className="space-y-4 print:space-y-0">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/sales"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="size-4" /> Back to sales
        </Link>
        {sale.status !== "completed" ? (
          <Badge variant="outline" className="uppercase">
            {sale.status}
          </Badge>
        ) : null}
      </div>
      <ThermalReceipt shopName={tenant.tenantName} sale={sale} />
    </div>
  );
}
