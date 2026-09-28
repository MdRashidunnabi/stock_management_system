"use client";

import { MIN_ADVANCE_DAYS } from "@/lib/reports/period";
import { useCart } from "@/components/storefront/cart-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function AdvanceDatePicker({ minDate }: { minDate: string }) {
  const { wantedForDate, setWantedForDate } = useCart();
  const value = wantedForDate && wantedForDate >= minDate ? wantedForDate : minDate;

  return (
    <div className="bg-card space-y-3 rounded-2xl border p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Choose your date</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Advance orders need at least {MIN_ADVANCE_DAYS} days&apos; notice. Then add products as
          usual.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="advance-date">Wanted for</Label>
        <Input
          id="advance-date"
          type="date"
          min={minDate}
          value={value}
          onChange={(e) => setWantedForDate(e.target.value || minDate)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setWantedForDate(value)}>
          Use {value}
        </Button>
        {wantedForDate ? (
          <Button type="button" variant="ghost" onClick={() => setWantedForDate(null)}>
            Clear — shop for today
          </Button>
        ) : null}
      </div>
    </div>
  );
}
