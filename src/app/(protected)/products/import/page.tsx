import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProductImporter } from "@/components/products/product-importer";
import { requireTenant } from "@/lib/auth/tenant";

export const metadata = { title: "Import products - ShopOS" };

export default async function ImportProductsPage() {
  const tenant = await requireTenant();
  const canWrite = ["owner", "manager", "warehouse"].includes(tenant.role);

  return (
    <div className="space-y-6">
      <Link
        href="/products"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Back to products
      </Link>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Bulk import products</h1>
        <p className="text-muted-foreground text-sm">
          Validate first, then commit. Up to 1000 rows per import.
        </p>
      </header>

      <ProductImporter canWrite={canWrite} />
    </div>
  );
}
