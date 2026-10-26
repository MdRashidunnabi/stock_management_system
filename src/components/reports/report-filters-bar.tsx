"use client";

import { useRouter } from "next/navigation";
import type { ReportChannel } from "@/lib/reports/period";
import type { ReportLookups } from "@/lib/reports/intelligence";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const PERIODS: Array<{ value: "today" | "week" | "month"; label: string }> = [
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
  from,
  to,
  channel,
  q,
  categoryId,
  brandId,
  supplierId,
  lookups,
}: {
  tab: string;
  period: "today" | "week" | "month" | "custom";
  from: string;
  to: string;
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
      from,
      to,
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
        const nextFrom = String(fd.get("from") ?? "");
        const nextTo = String(fd.get("to") ?? "");
        go({
          q: String(fd.get("q") ?? ""),
          category: String(fd.get("category") ?? ""),
          brand: String(fd.get("brand") ?? ""),
          supplier: String(fd.get("supplier") ?? ""),
          from: nextFrom,
          to: nextTo || nextFrom,
          period: nextFrom ? "custom" : period === "custom" ? "today" : period,
        });
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="report-kind">Report</Label>
          <select
            id="report-kind"
            value={tab}
            onChange={(e) => go({ tab: e.target.value })}
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
          >
            <option value="products">Sales report</option>
            <option value="catalogue">Stock report</option>
            <option value="channels">Till vs online</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => go({ period: p.value, from: "", to: "" })}
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={from} className="w-44" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={to} className="w-44" />
        </div>
        <p className="text-muted-foreground pb-2 text-xs">
          One day, or a range such as 5 October to 10 October. Then press Apply filters.
        </p>
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
