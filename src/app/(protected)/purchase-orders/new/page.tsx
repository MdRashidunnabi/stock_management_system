import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { listBranchesForCurrentTenant } from "@/lib/pos/actions";
import {
  listProductsForPurchasing,
  listSuppliersForCurrentTenant,
} from "@/lib/purchasing/orders/actions";
import { NewPurchaseOrderForm } from "@/components/purchasing/new-purchase-order-form";

export const metadata = { title: "New purchase order · ShopOS" };

export default async function NewPurchaseOrderPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  if (!["owner", "manager", "warehouse"].includes(tenant.role)) {
    redirect("/dashboard");
  }

  const [branches, suppliers, products] = await Promise.all([
    listBranchesForCurrentTenant(),
    listSuppliersForCurrentTenant(),
    listProductsForPurchasing(undefined, 200),
  ]);

  if (branches.length === 0) {
    return (
      <EmptyState
        title="No branches"
        body="You need at least one branch before you can create purchase orders."
      />
    );
  }
  if (suppliers.length === 0) {
    return (
      <EmptyState
        title="No suppliers yet"
        body="Add a supplier in Catalog → Suppliers before creating purchase orders."
      />
    );
  }
  if (products.length === 0) {
    return (
      <EmptyState
        title="No products yet"
        body="Add some products in Catalog → Products before creating purchase orders."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/purchase-orders"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-3" /> Purchase orders
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New purchase order</h1>
        <p className="text-muted-foreground text-sm">
          Order stock from a supplier. Costs are entered net of VAT (B2B convention) — VAT is
          applied per line based on the product's VAT code.
        </p>
      </div>

      <NewPurchaseOrderForm
        branches={branches.map((b) => ({ id: b.id, name: b.name, code: b.code ?? "" }))}
        suppliers={suppliers}
        products={products}
      />
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-border bg-card mx-auto max-w-xl rounded-lg border p-8 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{body}</p>
      <Link
        href="/purchase-orders"
        className="text-primary mt-4 inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-3" /> Back to purchase orders
      </Link>
    </div>
  );
}
