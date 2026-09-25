"use client";

import { useSyncExternalStore } from "react";
import { formatMoney } from "@/lib/utils";
import {
  emptyCustomerDisplay,
  getCustomerDisplayServerSnapshot,
  getCustomerDisplaySnapshot,
  subscribeCustomerDisplay,
} from "@/lib/pos/customer-display";

export function CustomerDisplayScreen() {
  const state = useSyncExternalStore(
    subscribeCustomerDisplay,
    getCustomerDisplaySnapshot,
    getCustomerDisplayServerSnapshot,
  );

  const view =
    state ??
    emptyCustomerDisplay({ tenantId: "", shopName: "ShopOS", currency: "EUR", locale: "en" });
  const money = (n: number) => formatMoney(n, view.currency, view.locale);
  const empty = view.lines.length === 0;
  const thankYou = view.phase === "thanks";
  const payingCard = view.phase === "pay-card";
  const payingCash = view.phase === "pay-cash" || view.phase === "change";
  const showChange =
    (view.phase === "change" || thankYou) && view.change != null && view.change > 0;

  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 px-8 py-6">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm tracking-[0.2em] uppercase">Welcome</p>
          <h1 className="truncate text-3xl font-semibold tracking-tight">
            {view.shopName || "ShopOS"}
          </h1>
        </div>
        {payingCard ? (
          <p className="rounded-full bg-sky-500/15 px-4 py-1.5 text-sm font-medium text-sky-800 dark:text-sky-300">
            Card
          </p>
        ) : null}
        {payingCash ? (
          <p className="rounded-full bg-emerald-500/15 px-4 py-1.5 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Cash
          </p>
        ) : null}
      </header>

      <main className="flex flex-1 flex-col px-8 pb-10">
        {thankYou ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-6xl font-semibold tracking-tight">Thank you</p>
            {showChange ? (
              <p className="mt-6 text-3xl font-medium">
                Change <span className="tabular-nums">{money(view.change ?? 0)}</span>
              </p>
            ) : null}
            <p className="text-muted-foreground mt-4 text-2xl tabular-nums">{money(view.total)}</p>
          </div>
        ) : empty ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-5xl font-semibold tracking-tight">Your items will appear here</p>
            <p className="text-muted-foreground mt-3 text-xl">
              Prices include VAT where shown on the till
            </p>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-1 overflow-y-auto py-2">
              {view.lines.map((line, i) => (
                <li
                  key={`${line.name}-${i}`}
                  className="flex items-start justify-between gap-6 border-b py-4"
                >
                  <span className="min-w-0">
                    <span className="block text-2xl leading-tight font-medium">{line.name}</span>
                    <span className="text-muted-foreground mt-1 block text-lg tabular-nums">
                      {line.qty} × {money(line.unitPrice)}
                    </span>
                  </span>
                  <span className="shrink-0 text-2xl font-semibold tabular-nums">
                    {money(line.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-auto space-y-4 pt-6">
              {showChange ? (
                <div className="rounded-3xl bg-emerald-600 px-8 py-6 text-white">
                  <p className="text-sm font-medium tracking-[0.2em] uppercase opacity-90">
                    Change
                  </p>
                  <p className="text-6xl font-semibold tracking-tight tabular-nums">
                    {money(view.change ?? 0)}
                  </p>
                  {view.given != null ? (
                    <p className="mt-2 text-lg opacity-90">You paid {money(view.given)}</p>
                  ) : null}
                </div>
              ) : null}

              {payingCard ? (
                <p className="text-muted-foreground text-center text-xl">
                  Please use the card machine
                </p>
              ) : null}

              <div className="flex items-end justify-between gap-4 border-t pt-5">
                <span className="text-muted-foreground text-2xl">Total</span>
                <span className="text-6xl font-semibold tracking-tight tabular-nums">
                  {money(view.total)}
                </span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
