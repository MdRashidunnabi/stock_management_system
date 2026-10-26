"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportCsvButton } from "@/components/reports/report-csv-button";

export function StockListActions({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
}) {
  function printList() {
    const body = rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${String(cell ?? "").replace(/</g, "")}</td>`).join("")}</tr>`,
      )
      .join("");
    const head = headers.map((cell) => `<th>${cell}</th>`).join("");
    const html = `<!doctype html><html><head><title>Stock</title><style>body{font-family:sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;font-size:12px}th{background:#f4f4f4}</style></head><body><h1>Stock</h1><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table><script>print()</script></body></html>`;
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
  }

  return (
    <div className="flex gap-2">
      <ReportCsvButton filename={filename} headers={headers} rows={rows} />
      <Button type="button" variant="outline" size="sm" onClick={printList}>
        <Printer className="size-4" />
        Print
      </Button>
    </div>
  );
}
