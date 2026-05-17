"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatEuro } from "@/lib/utils";

const TENDER_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "contactless", label: "Contactless" },
  { value: "apple_pay", label: "Apple Pay" },
  { value: "google_pay", label: "Google Pay" },
  { value: "revolut", label: "Revolut" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "voucher", label: "Voucher" },
  { value: "store_credit", label: "Store credit" },
] as const;

type Method = (typeof TENDER_METHODS)[number]["value"];

interface Tender {
  id: string;
  method: Method;
  amount: number;
}

interface Props {
  open: boolean;
  total: number;
  pending: boolean;
  /**
   * When true, only the `cash` tender is selectable. Used by the offline
   * POS path because card terminals require network connectivity.
   */
  cashOnly?: boolean;
  onClose: () => void;
  onConfirm: (payments: { method: Method; amount: number }[]) => void;
}

function buildInitialTenders(total: number): Tender[] {
  return [
    {
      id: cryptoRandom(),
      method: "cash",
      amount: round2(total),
    },
  ];
}

export function PosPaymentDialog({ open, total, pending, cashOnly, onClose, onConfirm }: Props) {
  const tenderMethods = useMemo(
    () => (cashOnly ? TENDER_METHODS.filter((m) => m.value === "cash") : TENDER_METHODS),
    [cashOnly],
  );
  // Reset the tender list each time the dialog opens. Using the "store info
  // from previous render" pattern (React docs) instead of an effect, so the
  // React Compiler doesn't flag a cascading-render setState-in-effect.
  const [openSnap, setOpenSnap] = useState(open);
  const [tenders, setTenders] = useState<Tender[]>(() => buildInitialTenders(total));
  if (open !== openSnap) {
    setOpenSnap(open);
    if (open) setTenders(buildInitialTenders(total));
  }

  const tendered = useMemo(
    () => round2(tenders.reduce((sum, t) => sum + (Number.isFinite(t.amount) ? t.amount : 0), 0)),
    [tenders],
  );
  const change = round2(tendered - total);
  const hasCash = tenders.some((t) => t.method === "cash");
  const isReady =
    tenders.length > 0 &&
    tenders.every((t) => t.amount > 0) &&
    // for cash you can over-tender (we hand back change). For non-cash methods
    // we require an exact match on the full sale, and the cash row absorbs change.
    (hasCash ? tendered + 0.005 >= total : Math.abs(tendered - total) < 0.005);

  function update(id: string, patch: Partial<Tender>) {
    setTenders((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function add() {
    const remaining = round2(total - tendered);
    setTenders((prev) => [
      ...prev,
      {
        id: cryptoRandom(),
        method: prev[0]?.method === "cash" ? "card" : "cash",
        amount: remaining > 0 ? remaining : 0,
      },
    ]);
  }
  function remove(id: string) {
    setTenders((prev) => prev.filter((t) => t.id !== id));
  }
  function setExactCash() {
    setTenders([{ id: cryptoRandom(), method: "cash", amount: round2(total) }]);
  }
  function setExactCard() {
    setTenders([{ id: cryptoRandom(), method: "card", amount: round2(total) }]);
  }

  function handleConfirm() {
    if (!isReady) return;
    // For cash overpayment we record the actual sale total against cash, not
    // the bigger tendered amount, so the books balance exactly. The cashier
    // hands back the displayed change.
    const payments: { method: Method; amount: number }[] = [];
    let outstanding = total;
    for (const t of tenders) {
      if (outstanding <= 0) break;
      const take = t.method === "cash" ? Math.min(t.amount, outstanding) : t.amount;
      const amt = round2(take);
      if (amt > 0) {
        payments.push({ method: t.method, amount: amt });
        outstanding = round2(outstanding - amt);
      }
    }
    if (payments.length === 0) return;
    onConfirm(payments);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Take payment</DialogTitle>
          <DialogDescription>
            Total due <strong className="text-foreground">{formatEuro(total)}</strong>. Add as many
            tenders as you need - card, cash, or split.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={setExactCash}>
            Exact cash
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={setExactCard}>
            Exact card
          </Button>
        </div>

        <ul className="space-y-2">
          {tenders.map((t, idx) => (
            <li
              key={t.id}
              className="border-border bg-muted/40 flex items-end gap-2 rounded-lg border p-2"
            >
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Method</Label>
                <select
                  value={t.method}
                  onChange={(e) => update(t.id, { method: e.target.value as Method })}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  {tenderMethods.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-32 space-y-1">
                <Label className="text-xs">Amount (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={t.amount}
                  onChange={(e) => update(t.id, { amount: Number(e.target.value) || 0 })}
                />
              </div>
              {tenders.length > 1 ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(t.id)}
                  className="text-muted-foreground hover:text-destructive mb-px size-9"
                  aria-label={`Remove tender ${idx + 1}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <Plus className="size-3.5" />
          Add another tender
        </Button>

        <div className="border-border bg-card mt-2 space-y-1 rounded-lg border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total due</span>
            <span className="font-mono">{formatEuro(total)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tendered</span>
            <span className="font-mono">{formatEuro(tendered)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold">
            <span>Change</span>
            <span className="font-mono">
              {change > 0 ? formatEuro(change) : "-"}
              {change > 0 && hasCash ? (
                <Badge variant="outline" className="ml-2">
                  give back
                </Badge>
              ) : null}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!isReady || pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Complete sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function cryptoRandom() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `t_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}
