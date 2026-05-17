import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReportPeriod } from "@/lib/reports/queries";

const PERIODS: Array<{ value: ReportPeriod; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
];

export function PeriodTabs({ active }: { active: ReportPeriod }) {
  return (
    <div
      role="tablist"
      aria-label="Report period"
      className="border-border bg-card inline-flex items-center gap-0 overflow-hidden rounded-md border p-0.5"
    >
      {PERIODS.map((p) => {
        const isActive = p.value === active;
        return (
          <Link
            key={p.value}
            role="tab"
            aria-selected={isActive}
            href={`/dashboard?period=${p.value}`}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground rounded-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}
