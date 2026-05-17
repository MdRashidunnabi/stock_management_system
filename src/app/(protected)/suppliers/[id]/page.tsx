import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { requireTenant } from "@/lib/auth/tenant";
import { getSupplier } from "@/lib/suppliers/actions";

export const metadata = { title: "Edit supplier - ShopOS" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditSupplierPage({ params }: Props) {
  const { id } = await params;
  const tenant = await requireTenant();
  const canWrite = ["owner", "manager", "warehouse"].includes(tenant.role);

  const supplier = await getSupplier(id);
  if (!supplier) notFound();

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
        <h1 className="text-2xl font-semibold tracking-tight">{supplier.name}</h1>
        <p className="text-muted-foreground text-sm">
          {supplier.code ? `Code ${supplier.code} · ` : ""}
          {supplier.is_active ? "Active supplier" : "Archived supplier"}
        </p>
      </header>

      <SupplierForm mode="edit" initial={supplier} canWrite={canWrite} />
    </div>
  );
}
