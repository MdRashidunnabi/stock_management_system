import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ProductForm } from "@/components/products/product-form";
import { listLookupsForProductForm } from "@/lib/catalog/products/actions";
import { requireTenant } from "@/lib/auth/tenant";

export const metadata = { title: "New product - ShopOS" };

export default async function NewProductPage() {
  const tenant = await requireTenant();
  const canWrite = ["owner", "manager", "warehouse"].includes(tenant.role);
  if (!canWrite) redirect("/products");

  const { categories, brands, suppliers } = await listLookupsForProductForm();

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
        <h1 className="text-2xl font-semibold tracking-tight">New product</h1>
        <p className="text-muted-foreground text-sm">
          Add a single item. For larger imports, use the bulk CSV import instead.
        </p>
      </header>

      <ProductForm
        mode="create"
        canWrite={canWrite}
        categories={categories}
        brands={brands}
        suppliers={suppliers}
      />
    </div>
  );
}
