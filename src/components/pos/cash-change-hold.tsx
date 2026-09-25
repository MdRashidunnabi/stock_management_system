"use client";

import { Button } from "@/components/ui/button";

/** Full-screen change reminder so the cashier cannot miss the return on a busy till. */
export function CashChangeHold({
  given,
  change,
  formatAmount,
  onDone,
}: {
  given: number;
  change: number;
  formatAmount: (n: number) => string;
  onDone: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4"
      data-no-hid-scan=""
    >
      <div className="bg-background w-full max-w-lg rounded-3xl p-8 text-center shadow-2xl">
        <p className="text-muted-foreground text-sm font-medium tracking-[0.2em] uppercase">
          Change to give
        </p>
        <p className="mt-3 text-7xl font-semibold tracking-tight text-emerald-700 tabular-nums dark:text-emerald-400">
          {formatAmount(change)}
        </p>
        <p className="text-muted-foreground mt-4 text-lg">They gave {formatAmount(given)}</p>
        <Button type="button" size="lg" className="mt-8 h-20 w-full text-xl" onClick={onDone}>
          Next sale
        </Button>
      </div>
    </div>
  );
}
