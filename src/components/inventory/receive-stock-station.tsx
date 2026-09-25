"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, ScanLine, Search } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHidScanner } from "@/hooks/use-hid-scanner";
import { lookupProductByBarcodeAction } from "@/lib/catalog/barcode-lookup";
import { adjustStockAction } from "@/lib/inventory/actions";
import { getSafeActionData, getSafeActionError } from "@/lib/parse-safe-action-result";
import { playScanTone } from "@/lib/pos/scan-tone";
import { entityIdSchema } from "@/lib/entity-id";
import type { ProductSearchResult } from "@/lib/pos/schemas";
import { cn } from "@/lib/utils";

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

type ReceiveLine = {
  at: number;
  name: string;
  qty: number;
  unit: string;
  previousQty: number;
  newQty: number;
};

interface Props {
  branches: BranchOption[];
  defaultBranchId: string | null;
}

function isValidBranchId(id: string): boolean {
  return entityIdSchema.safeParse(id).success;
}

export function ReceiveStockStation({ branches, defaultBranchId }: Props) {
  const fallback = defaultBranchId ?? branches[0]?.id ?? "";
  const [branchId, setBranchId] = useState(fallback);
  const activeBranchId = isValidBranchId(branchId) ? branchId : fallback;
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState<ProductSearchResult | null>(null);
  const [unknown, setUnknown] = useState<string | null>(null);
  const [qtyBuffer, setQtyBuffer] = useState("1");
  const [log, setLog] = useState<ReceiveLine[]>([]);
  const [pending, startLookup] = useTransition();
  const [saving, startSave] = useTransition();
  const scanRef = useRef<HTMLInputElement | null>(null);

  const qty = useMemo(() => {
    const n = Number(qtyBuffer);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n;
  }, [qtyBuffer]);

  function focusScan() {
    window.setTimeout(() => scanRef.current?.focus(), 0);
  }

  function identify(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    if (!isValidBranchId(activeBranchId)) {
      toast.error("Pick a branch first.");
      return;
    }
    setUnknown(null);
    startLookup(async () => {
      const res = await lookupProductByBarcodeAction({ branchId: activeBranchId, code: trimmed });
      const err = getSafeActionError(res);
      if (err) {
        playScanTone(false);
        toast.error(err);
        return;
      }
      const data = getSafeActionData<{ ok: true; product: ProductSearchResult | null }>(res);
      const found = data?.product ?? null;
      if (!found) {
        playScanTone(false);
        setProduct(null);
        setUnknown(trimmed);
        setQuery("");
        focusScan();
        return;
      }
      playScanTone(true);
      setProduct(found);
      setQtyBuffer("1");
      setQuery("");
      setUnknown(null);
    });
  }

  useHidScanner((code) => {
    if (product) {
      toast.message("Enter the quantity first, then scan the next item.");
      return;
    }
    identify(code);
  }, !saving && !product);

  function addToStock() {
    if (!product || qty <= 0 || saving) return;
    const p = product;
    const addQty = qty;
    startSave(async () => {
      const res = await adjustStockAction({
        productId: p.id,
        branchId: activeBranchId,
        mode: "delta",
        delta: addQty,
        reason: "Scan receive",
      });
      const err = getSafeActionError(res);
      if (err) {
        playScanTone(false);
        toast.error(err);
        return;
      }
      const data = getSafeActionData<{ ok: true; previousQty: number; newQty: number }>(res);
      if (!data) return;
      playScanTone(true);
      toast.success(`Added ${formatQty(addQty)} ${p.base_unit} · now ${formatQty(data.newQty)}`);
      setLog((prev) =>
        [
          {
            at: Date.now(),
            name: p.name,
            qty: addQty,
            unit: p.base_unit,
            previousQty: data.previousQty,
            newQty: data.newQty,
          },
          ...prev,
        ].slice(0, 40),
      );
      setProduct(null);
      setQtyBuffer("1");
      focusScan();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="receive-branch">Branch</Label>
            <select
              id="receive-branch"
              value={activeBranchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setProduct(null);
                setUnknown(null);
              }}
              className="border-input bg-background h-11 min-w-48 rounded-md border px-3 text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} - {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="receive-scan">Scan barcode</Label>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                id="receive-scan"
                ref={scanRef}
                autoFocus
                disabled={Boolean(product) || pending || saving}
                placeholder="Barcode"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  identify(query);
                }}
                className="h-12 pl-9 text-base"
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        {unknown ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>
                No product for barcode <span className="font-mono font-semibold">{unknown}</span>.
                Add it to the catalogue first.
              </span>
              <Button asChild size="sm" variant="secondary">
                <Link href="/products/new">Add product</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {product ? (
          <QtyPad
            product={product}
            qtyBuffer={qtyBuffer}
            qty={qty}
            pending={saving}
            onQty={setQtyBuffer}
            onCancel={() => {
              setProduct(null);
              setQtyBuffer("1");
              focusScan();
            }}
            onConfirm={addToStock}
          />
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 py-12 text-center">
              <ScanLine className="text-primary size-12" />
              <p className="text-xl font-semibold tracking-tight">
                {pending ? "Looking up…" : "Scan"}
              </p>
              {pending ? <Loader2 className="size-5 animate-spin" /> : null}
            </CardContent>
          </Card>
        )}
      </div>

      <aside className="space-y-3">
        <h2 className="text-sm font-medium">This session</h2>
        {log.length === 0 ? (
          <p className="text-muted-foreground text-sm">None yet.</p>
        ) : (
          <ul className="divide-border divide-y rounded-xl border">
            {log.map((line) => (
              <li key={line.at} className="px-4 py-3">
                <p className="font-medium">{line.name}</p>
                <p className="text-muted-foreground text-xs tabular-nums">
                  +{formatQty(line.qty)} {line.unit} · {formatQty(line.previousQty)} →{" "}
                  {formatQty(line.newQty)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

function QtyPad({
  product,
  qtyBuffer,
  qty,
  pending,
  onQty,
  onCancel,
  onConfirm,
}: {
  product: ProductSearchResult;
  qtyBuffer: string;
  qty: number;
  pending: boolean;
  onQty: (next: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;
  const chips = [1, 2, 5, 10, 20, 50];

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="flex items-start gap-4">
          {product.primary_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.primary_image_url}
              alt=""
              className="size-20 rounded-lg border object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-2xl font-semibold tracking-tight">{product.name}</p>
            <p className="text-muted-foreground mt-1 font-mono text-sm">
              {product.barcode ?? product.sku ?? "no barcode"}
            </p>
            <p className="mt-2 text-sm">
              On hand{" "}
              <span className="font-semibold tabular-nums">
                {formatQty(product.available)} {product.base_unit}
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl border p-5">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            Quantity arrived
          </p>
          <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
            {qtyBuffer || "0"}{" "}
            <span className="text-muted-foreground text-lg font-medium">{product.base_unit}</span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {chips.map((n) => (
            <Button
              key={n}
              type="button"
              variant="outline"
              className="h-14 text-lg font-semibold"
              disabled={pending}
              onClick={() => onQty(String(n))}
            >
              {n}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {keys.map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              className={cn("h-14 text-lg font-semibold", key === "clear" && "text-sm")}
              disabled={pending}
              onClick={() => {
                if (key === "clear") onQty("");
                else if (key === "back") onQty(qtyBuffer.slice(0, -1));
                else onQty(qtyBuffer === "0" ? key : `${qtyBuffer}${key}`);
              }}
            >
              {key === "clear" ? "C" : key === "back" ? "⌫" : key}
            </Button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-16 text-base"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-16 text-lg"
            disabled={pending || qty <= 0}
            onClick={onConfirm}
          >
            {pending ? <Loader2 className="size-5 animate-spin" /> : null}
            Add to stock
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n - Math.round(n)) < 0.0001) return String(Math.round(n));
  return n.toFixed(2);
}
