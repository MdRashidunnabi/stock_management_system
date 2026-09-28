"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportCsvButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
}) {
  function download() {
    const body = [headers, ...rows]
      .map((line) =>
        line
          .map((cell) => {
            const v = cell == null ? "" : String(cell);
            return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={download}>
      <Download className="size-4" />
      Download CSV
    </Button>
  );
}
