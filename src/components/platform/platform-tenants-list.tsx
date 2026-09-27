"use client";

import { useMemo, useState } from "react";
import { Pencil, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShopEditSheet } from "@/components/platform/shop-edit-sheet";

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
  tillActiveCount: number;
  tillTotalCount: number;
  teamPreview: string[];
};

export function PlatformTenantsList({ tenants }: { tenants: PlatformTenantRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [editId, setEditId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tenants.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (!needle) return true;
      return (
        t.displayName.toLowerCase().includes(needle) ||
        t.slug.toLowerCase().includes(needle) ||
        t.teamPreview.some((email) => email.toLowerCase().includes(needle))
      );
    });
  }, [tenants, q, status]);

  const editing = tenants.find((t) => t.id === editId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search shop, address, or team email…"
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
        {filtered.length} of {tenants.length} shops
      </p>

      <div className="border-border overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shop</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Card</TableHead>
              <TableHead>Trial</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Tills</TableHead>
              <TableHead className="bg-background sticky right-0 text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                  No shops match.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <p className="font-medium">{t.displayName}</p>
                    <p className="text-muted-foreground text-xs">{t.slug}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {t.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>€{t.monthlyEur.toFixed(2)}/mo</TableCell>
                  <TableCell>{t.cardOnFile ? `•••• ${t.cardLast4}` : "None"}</TableCell>
                  <TableCell>
                    {t.trialEndsAt ? t.trialEndsAt.slice(0, 10) : "—"}
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    <p>{t.memberCount}</p>
                    <p className="text-muted-foreground truncate text-xs" title={t.teamPreview.join(", ")}>
                      {t.teamPreview.join(", ") || "—"}
                    </p>
                  </TableCell>
                  <TableCell>
                    {t.tillActiveCount}
                    {t.tillTotalCount > t.tillActiveCount
                      ? ` / ${t.tillTotalCount}`
                      : ""}
                  </TableCell>
                  <TableCell className="bg-background sticky right-0 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditId(t.id)}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ShopEditSheet
        tenantId={editId}
        shopName={editing?.displayName}
        open={Boolean(editId)}
        onOpenChange={(open) => {
          if (!open) setEditId(null);
        }}
      />
    </div>
  );
}
