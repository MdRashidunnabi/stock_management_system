import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { listBranchesForCurrentTenant } from "@/lib/pos/actions";
import {
  getPurchaseOrder,
  listProductsForPurchasing,
  listSuppliersForCurrentTenant,
} from "@/lib/purchasing/orders/actions";
import { NewGoodsReceiptForm } from "@/components/purchasing/new-goods-receipt-form";

export const metadata = { title: "New goods receipt · ShopOS" };

type SearchParams = Promise<{ po?: string }>;

export default async function NewGoodsReceiptPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  if (!["owner", "manager", "warehouse"].includes(tenant.role)) {
    redirect("/dashboard");
  }

  const { po: poId } = await searchParams;

  const [branches, suppliers, products, po] = await Promise.all([
    listBranchesForCurrentTenant(),
    listSuppliersForCurrentTenant(),
    listProductsForPurchasing(undefined, 200),
    poId ? getPurchaseOrder(poId) : Promise.resolve(null),
  ]);

  if (poId && !po) {
    return (
      <EmptyState
        title="Purchase order not found"
        body="The purchase order you tried to receive could not be found in this shop."
      />
    );
  }
  if (po && (po.status === "received" || po.status === "cancelled" || po.status === "closed")) {
    return (
      <EmptyState
        title={`This PO is ${po.status}`}
        body="You can only receive goods against draft, ordered or partially-received purchase orders."
      />
    );
  }
  if (branches.length === 0) {
    return <EmptyState title="No branches" body="You need at least one branch to receive goods." />;
  }
  if (suppliers.length === 0) {
    return (
      <EmptyState
        title="No suppliers yet"
        body="Add a supplier in Catalog → Suppliers before recording goods receipts."
      />
    );
  }
  if (products.length === 0) {
    return (
      <EmptyState
        title="No products yet"
        body="Add products in Catalog → Products before recording goods receipts."
      />
    );
  }

  // Build initial rows from PO outstanding lines (qty defaults to outstanding)
  const initialRows = po
    ? po.items
        .filter((it) => it.qty_outstanding > 0)
        .map((it) => ({
          productId: it.product_id,
          quantity: it.qty_outstanding,
          unitCost: it.unit_cost,
          vatCode: it.vat_code,
        }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={po ? `/purchase-orders/${po.id}` : "/goods-receipts"}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-3" /> {po ? po.po_number : "Goods receipts"}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New goods receipt</h1>
        <p className="text-muted-foreground text-sm">
          {po
            ? `Pre-filled from purchase order ${po.po_number}. Adjust the actual quantities you received before finalising.`
            : "Log goods that arrived from a supplier without a prior purchase order."}
        </p>
      </div>

      <NewGoodsReceiptForm
        branches={branches.map((b) => ({ id: b.id, name: b.name, code: b.code ?? "" }))}
        suppliers={suppliers}
        products={products}
        defaultBranchId={po?.branch?.id ?? null}
        defaultSupplierId={po?.supplier?.id ?? null}
        purchaseOrder={
          po
            ? {
                id: po.id,
                poNumber: po.po_number,
                branchId: po.branch?.id ?? "",
                supplierId: po.supplier?.id ?? "",
              }
            : null
        }
        initialRows={initialRows}
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
        href="/goods-receipts"
        className="text-primary mt-4 inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-3" /> Back to goods receipts
      </Link>
    </div>
  );
}
