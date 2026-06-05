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
      ? "border-success/30 from-success/10 to-success/5 bg-gradient-to-br"
      : emphasis === "warn"
        ? "border-warning/35 from-warning/10 to-warning/5 bg-gradient-to-br"
        : emphasis === "bad"
          ? "border-destructive/30 from-destructive/10 to-destructive/5 bg-gradient-to-br"
          : "border-border/80 from-card to-muted/30 bg-gradient-to-br";

  const inner = (
    <div
      className={cn(
        "h-full rounded-xl border p-3 shadow-sm transition-shadow hover:shadow-md",
        tone,
      )}
    >
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span className="text-primary [&_svg]:text-primary">{icon}</span>
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
    <Link href={href} className="block hover:opacity-95">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function TrendBadge({ percent }: { percent: number }) {
  const isUp = percent > 0;
  const isFlat = Math.abs(percent) < 0.05;
  const tone = isFlat ? "text-muted-foreground" : isUp ? "text-success" : "text-destructive";
  const arrow = isFlat ? "→" : isUp ? "▲" : "▼";
  return (
    <span className={cn("text-xs font-medium", tone)}>
      {arrow} {Math.abs(percent).toFixed(1)}%
    </span>
  );
}
