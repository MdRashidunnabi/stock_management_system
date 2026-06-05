"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type PlatformTenantRow = {
  id: string;
  displayName: string;
  slug: string;
  status: string;
  trialEndsAt: string | null;
  cardOnFile: boolean;
  cardLast4: string | null;
  memberCount: number;
  monthlyEur: number;
};

export function PlatformTenantsList({ tenants }: { tenants: PlatformTenantRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tenants.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (!needle) return true;
      return t.displayName.toLowerCase().includes(needle) || t.slug.toLowerCase().includes(needle);
    });
  }, [tenants, q, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search by shop name or web address…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "trial", "active", "suspended", "past_due"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 text-xs capitalize ${
                status === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted"
              }`}
            >
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        Showing {filtered.length} of {tenants.length} shops
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <Link key={t.id} href={`/platform/tenants/${t.id}`}>
            <Card className="hover:border-primary/40 h-full transition-colors">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="text-primary size-5 shrink-0" />
                    <div>
                      <p className="leading-tight font-semibold">{t.displayName}</p>
                      <p className="text-muted-foreground text-xs">{t.slug}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {t.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
                  <span>Team: {t.memberCount}</span>
                  <span>€{t.monthlyEur.toFixed(2)}/mo</span>
                  <span>Card: {t.cardOnFile ? `•••• ${t.cardLast4}` : "None"}</span>
                  <span>
                    Trial:{" "}
                    {t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString("en-IE") : "—"}
                  </span>
                </div>
                <p className="text-info text-xs font-medium">Open shop controls →</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
