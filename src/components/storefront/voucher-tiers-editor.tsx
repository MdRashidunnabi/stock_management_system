"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VoucherTier } from "@/lib/vouchers/rules";

export function VoucherTiersEditor({
  title,
  tiers,
  onChange,
}: {
  title: string;
  tiers: VoucherTier[];
  onChange: (tiers: VoucherTier[]) => void;
}) {
  function patch(index: number, next: Partial<VoucherTier>) {
    onChange(tiers.map((tier, i) => (i === index ? { ...tier, ...next } : tier)));
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground text-xs">
        The customer gets the voucher for the highest spend they reach. Change the amounts any time.
      </p>
      {tiers.map((tier, index) => (
        <div key={index} className="flex items-end gap-2">
          <div className="space-y-1">
            <Label>Spend from (€)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={tier.from}
              onChange={(e) => patch(index, { from: Number(e.target.value) })}
              className="w-32"
            />
          </div>
          <div className="space-y-1">
            <Label>Voucher (€)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={tier.amount}
              onChange={(e) => patch(index, { amount: Number(e.target.value) })}
              className="w-28"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(tiers.filter((_, i) => i !== index))}
            aria-label="Remove voucher row"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={tiers.length >= 12}
        onClick={() => onChange([...tiers, { from: 0, amount: 0 }])}
      >
        <Plus className="size-4" />
        Add row
      </Button>
    </div>
  );
}
