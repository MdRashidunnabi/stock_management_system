"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FilePlus2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPurchaseOrderAction } from "@/lib/purchasing/orders/actions";
import { formatEuro } from "@/lib/utils";
import {
  VAT_CODES,
  type ProductLite,
  type SupplierLite,
  type VatCode,
} from "@/lib/purchasing/schemas";

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface Props {
  branches: BranchOption[];
  suppliers: SupplierLite[];
  products: ProductLite[];
}

interface LineRow {
  key: string;
  productId: string;
  quantity: string;
  unitCost: string;
  vatCode: VatCode;
  notes: string;
}

const VAT_RATES: Record<VatCode, number> = {
  STD: 0.23,
  RED: 0.135,
  SEC: 0.09,
  LIV: 0.048,
  ZER: 0,
  EXE: 0,
};

const VAT_LABELS: Record<VatCode, string> = {
  STD: "Standard 23%",
  RED: "Reduced 13.5%",
  SEC: "Second-reduced 9%",
  LIV: "Livestock 4.8%",
  ZER: "Zero 0%",
  EXE: "Exempt",
};

let counter = 0;
const newKey = () => `row-${++counter}`;

function emptyRow(defaults?: Partial<LineRow>): LineRow {
  return {
    key: newKey(),
    productId: "",
    quantity: "1",
    unitCost: "0.00",
    vatCode: "STD",
    notes: "",
    ...defaults,
  };
}

export function NewPurchaseOrderForm({ branches, suppliers, products }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState<string>(branches[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id ?? "");
  const [expectedAt, setExpectedAt] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [rows, setRows] = useState<LineRow[]>([emptyRow()]);

  const productById = useMemo(() => {
    const m = new Map<string, ProductLite>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  function patchRow(key: string, patch: Partial<LineRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
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

  const totals = useMemo(() => {
    let subtotal = 0;
    let vat = 0;
    for (const r of rows) {
      const qty = Number(r.quantity) || 0;
      const cost = Number(r.unitCost) || 0;
      if (qty <= 0 || cost < 0) continue;
      const lineNet = qty * cost;
      const lineVat = lineNet * VAT_RATES[r.vatCode];
      subtotal += lineNet;
      vat += lineVat;
    }
    return {
      subtotal: round2(subtotal),
      vat: round2(vat),
      total: round2(subtotal + vat),
    };
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
      const res = await createPurchaseOrderAction({
        branchId,
        supplierId,
        expectedAt: expectedAt || null,
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
        toast.success(`Purchase order ${res.data.poNumber} created.`);
        router.push(`/purchase-orders/${res.data.poId}`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="branch">Branch</Label>
          <select
            id="branch"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
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
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
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
          <Label htmlFor="expectedAt">Expected delivery</Label>
          <Input
            id="expectedAt"
            type="date"
            value={expectedAt}
            onChange={(e) => setExpectedAt(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Line items</Label>
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
                <th className="w-32 p-2 text-right font-medium">Unit cost (net)</th>
                <th className="w-44 p-2 font-medium">VAT</th>
                <th className="w-28 p-2 text-right font-medium">Line subtotal</th>
                <th className="w-12 p-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const product = r.productId ? productById.get(r.productId) : null;
                const qty = Number(r.quantity) || 0;
                const cost = Number(r.unitCost) || 0;
                const lineSubtotal = qty * cost;
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
                    <td className="p-2 text-right font-mono text-xs">
                      {formatEuro(round2(lineSubtotal))}
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
                <td colSpan={4} className="p-2 text-right text-xs font-medium">
                  Subtotal
                </td>
                <td className="p-2 text-right font-mono text-xs">{formatEuro(totals.subtotal)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={4} className="p-2 text-right text-xs font-medium">
                  VAT (estimated)
                </td>
                <td className="p-2 text-right font-mono text-xs">{formatEuro(totals.vat)}</td>
                <td />
              </tr>
              <tr className="border-border border-t">
                <td colSpan={4} className="p-2 text-right text-sm font-semibold">
                  Total
                </td>
                <td className="p-2 text-right font-mono text-sm font-semibold">
                  {formatEuro(totals.total)}
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
          placeholder="Internal notes for this purchase order"
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
              <FilePlus2 className="size-4" /> Create purchase order
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push("/purchase-orders")}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
