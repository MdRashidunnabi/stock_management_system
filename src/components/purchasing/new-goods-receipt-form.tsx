"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createGoodsReceiptAction } from "@/lib/purchasing/receipts/actions";
import {
  VAT_CODES,
  type ProductLite,
  type SupplierLite,
  type VatCode,
} from "@/lib/purchasing/schemas";
import { formatEuro } from "@/lib/utils";

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface InitialRow {
  productId: string;
  quantity: number;
  unitCost: number;
  vatCode: VatCode;
}

interface PurchaseOrderRef {
  id: string;
  poNumber: string;
  branchId: string;
  supplierId: string;
}

interface Props {
  branches: BranchOption[];
  suppliers: SupplierLite[];
  products: ProductLite[];
  defaultBranchId: string | null;
  defaultSupplierId: string | null;
  purchaseOrder: PurchaseOrderRef | null;
  initialRows: InitialRow[];
}

interface LineRow {
  key: string;
  productId: string;
  quantity: string;
  unitCost: string;
  vatCode: VatCode;
  expiryDate: string;
  lotNo: string;
  notes: string;
}

const VAT_LABELS: Record<VatCode, string> = {
  STD: "Standard 23%",
  RED: "Reduced 13.5%",
  SEC: "Second-reduced 9%",
  LIV: "Livestock 4.8%",
  ZER: "Zero 0%",
  EXE: "Exempt",
};

let counter = 0;
const newKey = () => `gr-row-${++counter}`;

function makeRow(initial?: Partial<LineRow>): LineRow {
  return {
    key: newKey(),
    productId: "",
    quantity: "1",
    unitCost: "0.00",
    vatCode: "STD",
    expiryDate: "",
    lotNo: "",
    notes: "",
    ...initial,
  };
}

export function NewGoodsReceiptForm({
  branches,
  suppliers,
  products,
  defaultBranchId,
  defaultSupplierId,
  purchaseOrder,
  initialRows,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState<string>(defaultBranchId ?? branches[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState<string>(defaultSupplierId ?? suppliers[0]?.id ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [invoiceTotal, setInvoiceTotal] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [rows, setRows] = useState<LineRow[]>(() => {
    if (initialRows.length === 0) return [makeRow()];
    return initialRows.map((it) =>
      makeRow({
        productId: it.productId,
        quantity: String(it.quantity),
        unitCost: it.unitCost.toFixed(4),
        vatCode: it.vatCode,
      }),
    );
  });

  const productById = useMemo(() => {
    const m = new Map<string, ProductLite>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  function patchRow(key: string, patch: Partial<LineRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== key)));
  }

  function pickProduct(rowKey: string, productId: string) {
    const product = productById.get(productId);
    patchRow(rowKey, {
      productId,
      vatCode: product?.vat_code ?? "STD",
      unitCost: product?.purchase_price != null ? product.purchase_price.toFixed(4) : "0.00",
    });
  }

  const totalCost = useMemo(() => {
    let sum = 0;
    for (const r of rows) {
      const qty = Number(r.quantity) || 0;
      const cost = Number(r.unitCost) || 0;
      if (qty <= 0 || cost < 0) continue;
      sum += qty * cost;
    }
    return Math.round(sum * 100) / 100;
  }, [rows]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const payloadItems = rows
      .filter((r) => r.productId && Number(r.quantity) > 0)
      .map((r) => ({
        productId: r.productId,
        quantity: Number(r.quantity),
        unitCost: Number(r.unitCost),
        vatCode: r.vatCode,
        expiryDate: r.expiryDate || null,
        lotNo: r.lotNo.trim() || null,
        notes: r.notes.trim() || null,
      }));

    if (payloadItems.length === 0) {
      setServerError("Add at least one line with a product and quantity > 0.");
      return;
    }
    if (!branchId || !supplierId) {
      setServerError("Choose a branch and a supplier.");
      return;
    }

    startTransition(async () => {
      const res = await createGoodsReceiptAction({
        branchId,
        supplierId,
        purchaseOrderId: purchaseOrder?.id ?? null,
        invoiceNumber: invoiceNumber.trim() || null,
        invoiceTotal: invoiceTotal ? Number(invoiceTotal) : null,
        notes: notes.trim() || null,
        items: payloadItems,
      });
      if (res?.serverError) {
        setServerError(res.serverError);
        return;
      }
      if (res?.validationErrors) {
        setServerError("Please check the form fields.");
        return;
      }
      if (res?.data?.ok) {
        toast.success(`Goods receipt ${res.data.grNumber} created (draft).`);
        router.push(`/goods-receipts/${res.data.grId}`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {purchaseOrder ? (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            This receipt will be linked to purchase order{" "}
            <span className="font-mono font-medium">{purchaseOrder.poNumber}</span>. Branch and
            supplier are locked to match the PO.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="branch">Branch</Label>
          <select
            id="branch"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={!!purchaseOrder}
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm disabled:opacity-60"
            required
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code ? `${b.code} - ` : ""}
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier">Supplier</Label>
          <select
            id="supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            disabled={!!purchaseOrder}
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm disabled:opacity-60"
            required
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code ? `${s.code} - ` : ""}
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="invoiceNumber">Invoice #</Label>
          <Input
            id="invoiceNumber"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            maxLength={120}
            placeholder="INV-12345"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invoiceTotal">Invoice total (EUR)</Label>
          <Input
            id="invoiceTotal"
            type="number"
            min={0}
            step="0.01"
            value={invoiceTotal}
            onChange={(e) => setInvoiceTotal(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Received line items</Label>
          <Button type="button" size="sm" variant="outline" onClick={addRow}>
            <Plus className="size-4" /> Add line
          </Button>
        </div>

        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-muted-foreground text-left text-xs">
                <th className="p-2 font-medium">Product</th>
                <th className="w-24 p-2 text-right font-medium">Qty</th>
                <th className="w-32 p-2 text-right font-medium">Unit cost</th>
                <th className="w-44 p-2 font-medium">VAT</th>
                <th className="w-32 p-2 font-medium">Expiry</th>
                <th className="w-28 p-2 font-medium">Lot #</th>
                <th className="w-12 p-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const product = r.productId ? productById.get(r.productId) : null;
                return (
                  <tr key={r.key} className="border-border border-t align-top">
                    <td className="p-2">
                      <select
                        value={r.productId}
                        onChange={(e) => pickProduct(r.key, e.target.value)}
                        className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                      >
                        <option value="">Pick a product…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku ? `${p.sku} - ` : ""}
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {product?.base_unit ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          unit: {product.base_unit}
                          {product.purchase_price != null
                            ? ` · last cost ${formatEuro(product.purchase_price)}`
                            : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-2 text-right">
                      <Input
                        type="number"
                        min={0}
                        step="0.0001"
                        value={r.quantity}
                        onChange={(e) => patchRow(r.key, { quantity: e.target.value })}
                        className="h-9 text-right font-mono"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <Input
                        type="number"
                        min={0}
                        step="0.0001"
                        value={r.unitCost}
                        onChange={(e) => patchRow(r.key, { unitCost: e.target.value })}
                        className="h-9 text-right font-mono"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={r.vatCode}
                        onChange={(e) => patchRow(r.key, { vatCode: e.target.value as VatCode })}
                        className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                      >
                        {VAT_CODES.map((c) => (
                          <option key={c} value={c}>
                            {VAT_LABELS[c]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <Input
                        type="date"
                        value={r.expiryDate}
                        onChange={(e) => patchRow(r.key, { expiryDate: e.target.value })}
                        className="h-9"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={r.lotNo}
                        onChange={(e) => patchRow(r.key, { lotNo: e.target.value })}
                        maxLength={120}
                        className="h-9 font-mono text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(r.key)}
                        disabled={rows.length === 1}
                        aria-label="Remove line"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/20">
              <tr className="border-border border-t">
                <td colSpan={5} className="p-2 text-right text-xs font-medium">
                  Total cost (net of VAT)
                </td>
                <td className="p-2 text-right font-mono text-sm font-semibold">
                  {formatEuro(totalCost)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything worth noting (damaged boxes, partial delivery, etc.)"
        />
      </div>

      {serverError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Truck className="size-4" /> Save as draft
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Drafts don&apos;t change inventory yet — review the receipt and click Finalise on the next
        screen to commit it.
      </p>
    </form>
  );
}
