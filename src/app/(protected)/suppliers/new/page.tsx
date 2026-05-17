import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { requireTenant } from "@/lib/auth/tenant";

export const metadata = { title: "New supplier - ShopOS" };

export default async function NewSupplierPage() {
  const tenant = await requireTenant();
  const canWrite = ["owner", "manager", "warehouse"].includes(tenant.role);
  if (!canWrite) redirect("/suppliers");

  return (
    <div className="space-y-6">
      <Link
        href="/suppliers"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Back to suppliers
      </Link>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New supplier</h1>
        <p className="text-muted-foreground text-sm">
          Add a wholesaler, manufacturer, or any vendor you buy stock from.
        </p>
      </header>

      <SupplierForm mode="create" canWrite={canWrite} />
    </div>
  );
}
