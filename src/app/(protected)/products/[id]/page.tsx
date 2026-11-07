import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AdjustStockCard } from "@/components/products/adjust-stock-card";
import { ProductForm } from "@/components/products/product-form";
import { getProduct, listLookupsForProductForm } from "@/lib/catalog/products/actions";
import { requireRole } from "@/lib/auth/tenant";
import { getStorefrontSettingsForTenant } from "@/lib/storefront/settings-queries";
import { getProductStockByBranch, getStockPoolInfo } from "@/lib/inventory/actions";

export const metadata = { title: "Edit product - ShopOS" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const tenant = await requireRole(["owner", "manager", "warehouse"]);
  const canWrite = ["owner", "manager", "warehouse"].includes(tenant.role);

  const [product, lookups, branchStock, storefront, pool] = await Promise.all([
    getProduct(id),
    listLookupsForProductForm(),
    getProductStockByBranch(id),
    getStorefrontSettingsForTenant(tenant.tenantId),
    getStockPoolInfo(id),
  ]);
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

      {pool?.kind === "cut" ? (
        <p className="bg-muted/50 rounded-md border px-4 py-3 text-sm">
          This cut has no stock of its own. Every sale takes the weight off{" "}
          <Link href={`/products/${pool.source.id}`} className="font-medium underline">
            {pool.source.name}
          </Link>
          , and its cost per kg is that item&apos;s cost. Buy and count stock on that item.
        </p>
      ) : null}
      {pool?.kind === "pool" ? (
        <div className="bg-muted/50 space-y-2 rounded-md border px-4 py-3 text-sm">
          <p>
            Buy this item from the supplier. It is not sold itself: these cuts sell from its stock,
            and each costs this item&apos;s price per kg.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {pool.cuts.map((cut) => (
              <li key={cut.id}>
                <Link href={`/products/${cut.id}`} className="underline">
                  {cut.name}
                </Link>
                {cut.sku ? <span className="text-muted-foreground"> ({cut.sku})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AdjustStockCard
        key={`${product.id}-${branchStock.map((b) => `${b.branchId}:${b.availableQty}`).join("|")}`}
        productId={product.id}
        productName={product.name}
        baseUnit={product.base_unit}
        branchStock={branchStock}
        canWrite={canWrite}
      />

      <ProductForm
        mode="edit"
        initial={product}
        canWrite={canWrite}
        categories={lookups.categories}
        brands={lookups.brands}
        suppliers={lookups.suppliers}
        onlinePriceMarkupPct={storefront?.onlinePriceMarkupPct ?? 0.5}
        vatRates={tenant.vatRates}
      />
    </div>
  );
}
