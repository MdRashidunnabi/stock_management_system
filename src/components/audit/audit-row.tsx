"use client";

import { useState } from "react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatDateTimeIE, cn } from "@/lib/utils";
import { diffSnapshots, type AuditLogRow } from "@/lib/audit/schemas";

interface Props {
  row: AuditLogRow;
}

const VERB_TONE: Record<string, string> = {
  created: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  updated: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  deleted: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

export function AuditRow({ row }: Props) {
  const [open, setOpen] = useState(false);
  const verb = row.action.split(".").pop() ?? "";
  const tone = VERB_TONE[verb] ?? "bg-muted text-muted-foreground";
  const diffs = diffSnapshots(row.before, row.after);

  return (
    <>
      <TableRow onClick={() => setOpen((o) => !o)} className="hover:bg-muted/40 cursor-pointer">
        <TableCell className="w-8">
          <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
        </TableCell>
        <TableCell className="text-xs whitespace-nowrap">
          {formatDateTimeIE(row.created_at)}
        </TableCell>
        <TableCell>
          <span className={cn("rounded px-1.5 py-0.5 font-mono text-[11px]", tone)}>
            {row.action}
          </span>
        </TableCell>
        <TableCell className="text-xs">{row.user_label}</TableCell>
        <TableCell className="text-xs">
          {row.entity_id ? (
            <span className="font-mono text-[11px]">{row.entity_id.slice(0, 8)}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">
          {row.before === null && row.after !== null
            ? `${diffs.length} field${diffs.length === 1 ? "" : "s"} set`
            : row.before !== null && row.after === null
              ? "row removed"
              : `${diffs.length} field${diffs.length === 1 ? "" : "s"} changed`}
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/20">
            <div className="space-y-2 p-2">
              <div className="text-muted-foreground flex items-center gap-1 text-xs">
                <ShieldCheck className="size-3" /> Recorded by tenant database trigger
              </div>
              {diffs.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No tracked field changes (timestamps only).
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="text-left">
                        <th className="border-border border-b py-1 pr-3 font-medium">Field</th>
                        <th className="border-border border-b py-1 pr-3 font-medium">Before</th>
                        <th className="border-border border-b py-1 font-medium">After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diffs.map((d) => (
                        <tr key={d.field} className="align-top">
                          <td className="border-border border-b py-1 pr-3 font-mono text-[11px]">
                            {d.field}
                          </td>
                          <td className="border-border border-b py-1 pr-3 font-mono text-[11px]">
                            {renderValue(d.before)}
                          </td>
                          <td className="border-border border-b py-1 font-mono text-[11px]">
                            {renderValue(d.after)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {row.entity_id ? (
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Badge variant="outline" className="font-mono">
                    {row.entity_type}
                  </Badge>
                  <span className="font-mono">{row.entity_id}</span>
                </div>
              ) : null}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 80 ? v.slice(0, 80) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const json = JSON.stringify(v);
  return json.length > 80 ? json.slice(0, 80) + "…" : json;
}
