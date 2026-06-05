"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getSafeActionData, getSafeActionError } from "@/lib/parse-safe-action-result";
import { adjustStockAction } from "@/lib/inventory/actions";
import type { ProductBranchStockRow } from "@/lib/inventory/schemas";

interface Props {
  productId: string;
  productName: string;
  baseUnit: string;
  branchStock: ProductBranchStockRow[];
  canWrite: boolean;
}

export function AdjustStockCard({
  productId,
  productName,
  baseUnit,
  branchStock,
  canWrite,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [rows, setRows] = useState(branchStock);
  const [branchId, setBranchId] = useState(branchStock[0]?.branchId ?? "");
  const [mode, setMode] = useState<"set" | "delta">("set");
  const [newQuantity, setNewQuantity] = useState(() => String(branchStock[0]?.availableQty ?? ""));
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    queueMicrotask(() => setRows(branchStock));
  }, [branchStock]);

  const selected = useMemo(
    () => rows.find((b) => b.branchId === branchId) ?? null,
    [rows, branchId],
  );

  function apply() {
    setServerError(null);
    const currentQty = selected?.availableQty ?? 0;
    if (mode === "set") {
      const target = Number(newQuantity);
      if (!Number.isFinite(target) || target < 0) {
        setServerError("Enter a valid quantity.");
        return;
      }
      if (Math.abs(target - currentQty) < 0.0001) {
        toast.message(`Already ${formatQty(currentQty)} ${baseUnit} at this branch.`);
        return;
      }
    } else {
      const change = Number(delta);
      if (!Number.isFinite(change) || change === 0) {
        setServerError("Enter a non-zero change (e.g. 5 or -2).");
        return;
      }
      if (currentQty + change < 0) {
        setServerError(`Cannot remove more than on hand (${formatQty(currentQty)}).`);
        return;
      }
    }

    startTransition(async () => {
      const res = await adjustStockAction({
        productId,
        branchId,
        reason: reason.trim() || undefined,
        mode,
        ...(mode === "set" ? { newQuantity: Number(newQuantity) } : { delta: Number(delta) }),
      });
      const err = getSafeActionError(res);
      if (err) {
        setServerError(err);
        toast.error(err);
        return;
      }
      const data = getSafeActionData<{
        ok: true;
        previousQty: number;
        newQty: number;
      }>(res);
      if (data) {
        setRows((prev) =>
          prev.map((b) => (b.branchId === branchId ? { ...b, availableQty: data.newQty } : b)),
        );
        setNewQuantity(String(data.newQty));
        setDelta("");
        setReason("");
        toast.success(
          `Stock updated: ${formatQty(data.previousQty)} → ${formatQty(data.newQty)} ${baseUnit}`,
        );
        router.refresh();
      }
    });
  }

  if (!canWrite) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="size-4" />
            Stock on hand
          </CardTitle>
        </CardHeader>
        <CardContent>
          {branchStock.length === 0 ? (
            <p className="text-muted-foreground text-sm">No branch stock recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rows.map((b) => (
                <li key={b.branchId} className="flex justify-between gap-2">
                  <span>
                    {b.branchCode} · {b.branchName}
                  </span>
                  <span className="font-mono font-medium">
                    {formatQty(b.availableQty)} {baseUnit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }

  if (branchStock.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adjust stock</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Add an active branch before adjusting stock.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="size-4" />
          Adjust stock
        </CardTitle>
        <CardDescription className="text-xs">
          Set the shelf count or add/remove units for <strong>{productName}</strong>. Changes are
          logged in the audit trail.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="adj-branch">Branch</Label>
          <select
            id="adj-branch"
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value);
              const row = rows.find((b) => b.branchId === e.target.value);
              if (row) setNewQuantity(String(row.availableQty));
            }}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            disabled={pending}
          >
            {rows.map((b) => (
              <option key={b.branchId} value={b.branchId}>
                {b.branchCode} — {b.branchName} (now {formatQty(b.availableQty)} {baseUnit})
              </option>
            ))}
          </select>
        </div>

        {selected ? (
          <p className="text-muted-foreground text-xs">
            Current available:{" "}
            <span className="text-foreground font-mono font-medium">
              {formatQty(selected.availableQty)} {baseUnit}
            </span>
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "set" ? "default" : "outline"}
            onClick={() => {
              setMode("set");
              if (selected) setNewQuantity(String(selected.availableQty));
            }}
            disabled={pending}
          >
            Set exact count
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "delta" ? "default" : "outline"}
            onClick={() => setMode("delta")}
            disabled={pending}
          >
            Add / remove
          </Button>
        </div>

        {mode === "set" ? (
          <div className="space-y-2">
            <Label htmlFor="adj-new-qty">New quantity ({baseUnit})</Label>
            <Input
              id="adj-new-qty"
              type="number"
              min={0}
              step={baseUnit === "kg" || baseUnit === "L" ? 0.001 : 1}
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              disabled={pending}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="adj-delta">Change (+/− {baseUnit})</Label>
            <Input
              id="adj-delta"
              type="number"
              step={baseUnit === "kg" || baseUnit === "L" ? 0.001 : 1}
              placeholder="e.g. 10 or -3"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              disabled={pending}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="adj-reason">Reason (optional)</Label>
          <Textarea
            id="adj-reason"
            rows={2}
            placeholder="e.g. Stock count, breakage (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={pending}
          />
        </div>

        {serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="button" onClick={apply} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Update stock
        </Button>
      </CardContent>
    </Card>
  );
}

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n - Math.round(n)) < 0.0001) return String(Math.round(n));
  return n.toFixed(2);
}
