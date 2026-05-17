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
  // Floor floor of 1 so an empty day still gets a visible (0%) baseline.
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
      <div className="border-border bg-card relative rounded-lg border p-3">
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
                      ? "bg-primary w-full rounded-t-sm transition-opacity group-hover:opacity-90"
                      : "bg-primary/40 group-hover:bg-primary/60 w-full rounded-t-sm transition-colors"
                  }
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-1.5">
          {series.map((p) => (
            <div
              key={`${p.day}-label`}
              className="text-muted-foreground flex-1 text-center text-[10px] tabular-nums"
            >
              {formatShortDate(p.day)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatShortDate(iso: string) {
  // iso = "YYYY-MM-DD"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}`;
}
