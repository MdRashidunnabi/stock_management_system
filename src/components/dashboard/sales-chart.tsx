import { formatEuro } from "@/lib/utils";
import type { DailySalesPoint } from "@/lib/reports/queries";

interface Props {
  series: DailySalesPoint[];
  /** Highlight the last N points (default 1 = today). */
  highlightLast?: number;
}

/**
 * Lightweight, server-rendered bar chart. No client JS, no charting lib.
 * Each day is a column; height is proportional to the maximum revenue
 * across the series. The label below shows DD/MM.
 */
export function SalesChart({ series, highlightLast = 1 }: Props) {
  if (series.length === 0) {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">No sales yet in this window.</p>
    );
  }

  const max = Math.max(...series.map((p) => p.revenue));
  const denom = max > 0 ? max : 1;

  const total = series.reduce((s, p) => s + p.revenue, 0);
  const totalCount = series.reduce((s, p) => s + p.salesCount, 0);

  return (
    <div className="space-y-3">
      <div className="text-muted-foreground flex items-end justify-between text-xs">
        <span>
          Daily revenue · {series.length} day{series.length === 1 ? "" : "s"}
        </span>
        <span>
          {formatEuro(total)} ({totalCount} sale{totalCount === 1 ? "" : "s"})
        </span>
      </div>
      <div className="border-border/80 from-card to-muted/20 relative rounded-xl border bg-gradient-to-b p-3">
        <div className="flex h-40 items-end gap-1.5">
          {series.map((p, idx) => {
            const isHighlight = idx >= series.length - highlightLast;
            const heightPct = (p.revenue / denom) * 100;
            return (
              <div
                key={p.day}
                className="group flex h-full flex-1 flex-col items-center justify-end"
                title={`${p.day} · ${formatEuro(p.revenue)} (${p.salesCount} sale${p.salesCount === 1 ? "" : "s"})`}
              >
                <div
                  className={
                    isHighlight
                      ? "bg-primary w-full rounded-t-md transition-opacity group-hover:opacity-90"
                      : "bg-chart-2/50 group-hover:bg-chart-2/70 w-full rounded-t-md transition-colors"
                  }
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="text-muted-foreground mt-2 flex justify-between gap-1 text-[10px]">
          {series.map((p) => {
            const [, m, d] = p.day.split("-");
            return (
              <span key={p.day} className="flex-1 truncate text-center">
                {d}/{m}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
