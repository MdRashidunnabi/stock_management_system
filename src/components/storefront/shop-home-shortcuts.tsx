import Link from "next/link";
import { CalendarClock, Percent } from "lucide-react";
import { MIN_ADVANCE_DAYS } from "@/lib/reports/period";

export function ShopHomeShortcuts({ shopSlug }: { shopSlug: string }) {
  const base = `/shop/${shopSlug}`;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Link
        href={`${base}/offers`}
        className="bg-card hover:border-primary/50 flex items-start gap-3 rounded-2xl border p-4 shadow-sm transition-colors"
      >
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
          <Percent className="size-5" />
        </span>
        <span>
          <span className="block font-semibold">Discounted products</span>
          <span className="text-muted-foreground mt-0.5 block text-sm">
            See only items that are on offer right now.
          </span>
        </span>
      </Link>
      <Link
        href={`${base}/advance`}
        className="bg-card hover:border-primary/50 flex items-start gap-3 rounded-2xl border p-4 shadow-sm transition-colors"
      >
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
          <CalendarClock className="size-5" />
        </span>
        <span>
          <span className="block font-semibold">Order ahead</span>
          <span className="text-muted-foreground mt-0.5 block text-sm">
            Book for a date at least {MIN_ADVANCE_DAYS} days from today — delivery or collection.
          </span>
        </span>
      </Link>
    </div>
  );
}
