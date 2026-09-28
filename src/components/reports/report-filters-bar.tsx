"use client";

import { useRouter } from "next/navigation";
import type { ReportChannel, ReportPeriod } from "@/lib/reports/period";
import type { ReportLookups } from "@/lib/reports/intelligence";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const PERIODS: Array<{ value: ReportPeriod; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

const CHANNELS: Array<{ value: ReportChannel; label: string }> = [
  { value: "all", label: "Till + online" },
  { value: "pos", label: "Till only" },
  { value: "online", label: "Online only" },
];

export function ReportFiltersBar({
  tab,
  period,
  channel,
  q,
  categoryId,
  brandId,
  supplierId,
  lookups,
}: {
  tab: string;
  period: ReportPeriod;
  channel: ReportChannel;
  q: string;
  categoryId: string;
  brandId: string;
  supplierId: string;
  lookups: ReportLookups;
}) {
  const router = useRouter();

  function go(next: Record<string, string>) {
    const p = new URLSearchParams();
    const merged = {
      tab,
      period,
      channel,
      q,
      category: categoryId,
      brand: brandId,
      supplier: supplierId,
      ...next,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all") p.set(k, v);
    }
    router.push(`/reports?${p.toString()}`);
  }

  return (
    <form
      className="border-border bg-card space-y-4 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        go({
          q: String(fd.get("q") ?? ""),
          category: String(fd.get("category") ?? ""),
          brand: String(fd.get("brand") ?? ""),
          supplier: String(fd.get("supplier") ?? ""),
        });
      }}
    >
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => go({ period: p.value })}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium",
              period === p.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
        {CHANNELS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => go({ channel: c.value })}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium",
              channel === c.value
                ? "bg-foreground text-background"
                : "border-border hover:bg-accent rounded-md border",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="q">SKU, barcode, or name</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Search…" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            name="category"
            defaultValue={categoryId}
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          >
            <option value="">All categories</option>
            {lookups.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="brand">Brand</Label>
          <select
            id="brand"
            name="brand"
            defaultValue={brandId}
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          >
            <option value="">All brands</option>
            {lookups.brands.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="supplier">Supplier</Label>
          <select
            id="supplier"
            name="supplier"
            defaultValue={supplierId}
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          >
            <option value="">All suppliers</option>
            {lookups.suppliers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="submit"
        className="bg-primary text-primary-foreground inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
      >
        Apply filters
      </button>
    </form>
  );
}
