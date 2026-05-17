import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ProductForm } from "@/components/products/product-form";
import { getProduct, listLookupsForProductForm } from "@/lib/catalog/products/actions";
import { requireTenant } from "@/lib/auth/tenant";

export const metadata = { title: "Edit product - ShopOS" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const tenant = await requireTenant();
  const canWrite = ["owner", "manager", "warehouse"].includes(tenant.role);

  const [product, lookups] = await Promise.all([getProduct(id), listLookupsForProductForm()]);
  if (!product) notFound();

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
        <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
        <p className="text-muted-foreground text-sm">
          {product.sku ? `SKU ${product.sku} · ` : ""}
          {product.is_active ? "Active product" : "Archived product"}
        </p>
      </header>

      <ProductForm
        mode="edit"
        initial={product}
        canWrite={canWrite}
        categories={lookups.categories}
        brands={lookups.brands}
        suppliers={lookups.suppliers}
      />
    </div>
  );
}
