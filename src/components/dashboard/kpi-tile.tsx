import Link from "next/link";
import { cn } from "@/lib/utils";

interface Props {
  href?: string;
  icon?: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  /** Negative numbers shown red, positive green; null = neutral. */
  trend?: number | null;
  emphasis?: "default" | "good" | "warn" | "bad";
}

export function KpiTile({ href, icon, label, value, hint, trend, emphasis = "default" }: Props) {
  const tone =
    emphasis === "good"
      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/40"
      : emphasis === "warn"
        ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/40"
        : emphasis === "bad"
          ? "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/40"
          : "border-border bg-card";

  const inner = (
    <div className={cn("h-full rounded-lg border p-3 transition-colors", tone)}>
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {trend != null ? <TrendBadge percent={trend} /> : null}
      </div>
      {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="hover:opacity-90">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function TrendBadge({ percent }: { percent: number }) {
  const isUp = percent > 0;
  const isFlat = Math.abs(percent) < 0.05;
  const tone = isFlat
    ? "text-muted-foreground"
    : isUp
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-rose-700 dark:text-rose-400";
  const arrow = isFlat ? "→" : isUp ? "▲" : "▼";
  return (
    <span className={cn("text-xs font-medium", tone)}>
      {arrow} {Math.abs(percent).toFixed(1)}%
    </span>
  );
}
