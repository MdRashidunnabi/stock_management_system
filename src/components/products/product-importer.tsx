"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  commitProductsImportAction,
  parseProductsCsvAction,
} from "@/lib/catalog/products-import/actions";
import type { ParsedProductRow } from "@/lib/catalog/products-import/schemas";

const TEMPLATE_CSV = `name,sku,barcode,category,brand,supplier,purchase_price,selling_price,vat_code,vat_included,base_unit,is_active
Tayto Cheese & Onion 45g,TAY-CO-45,5012345678901,Beverages,Tayto,DEMO-WHOLESALE,0.45,1.20,STD,true,un,true
Ballygowan Still 500ml,BWG-500,5012345678902,Beverages,,,0.40,1.10,SEC,true,un,true
`;

interface Props {
  canWrite: boolean;
}

interface ParseResult {
  rows: ParsedProductRow[];
  summary: { total: number; valid: number; errors: number };
}

export function ProductImporter({ canWrite }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsePending, startParse] = useTransition();
  const [commitPending, startCommit] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.onerror = () => toast.error("Could not read file");
    reader.readAsText(file);
  }

  function handleParse() {
    setServerError(null);
    setParseResult(null);
    startParse(async () => {
      const res = await parseProductsCsvAction({ csvText });
      if (res?.serverError) {
        setServerError(res.serverError);
        return;
      }
      if (res?.validationErrors) {
        setServerError("Please paste or upload a non-empty CSV.");
        return;
      }
      if (res?.data?.ok) {
        setParseResult({ rows: res.data.rows, summary: res.data.summary });
        toast.success(
          `Validated ${res.data.summary.total} rows (${res.data.summary.valid} valid, ${res.data.summary.errors} with errors)`,
        );
      }
    });
  }

  function handleCommit() {
    if (!parseResult) return;
    const validRows = parseResult.rows
      .filter((r) => r.ok && r.payload)
      .map((r) => {
        const p = r.payload!;
        return {
          name: p.name,
          sku: p.sku ?? null,
          barcode: p.barcode ?? null,
          category_id: p.categoryId ?? null,
          brand_id: p.brandId ?? null,
          default_supplier_id: p.defaultSupplierId ?? null,
          purchase_price: p.purchasePrice,
          selling_price: p.sellingPrice,
          vat_code: p.vatCode,
          vat_included: p.vatIncluded,
          base_unit: p.baseUnit,
          is_active: p.isActive,
        };
      });

    if (validRows.length === 0) {
      toast.error("Nothing to import. Fix the errors first.");
      return;
    }

    setServerError(null);
    startCommit(async () => {
      const res = await commitProductsImportAction({ rows: validRows });
      if (res?.serverError) {
        setServerError(res.serverError);
        return;
      }
      if (res?.data?.ok) {
        toast.success(`Imported ${res.data.inserted} products`);
        setCsvText("");
        setParseResult(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.push("/products");
        router.refresh();
      }
    });
  }

  function handleDownloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shopos-products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!canWrite) {
    return (
      <Alert>
        <AlertDescription>
          Only owners, managers, and warehouse staff can import products.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Prepare your CSV</CardTitle>
          <CardDescription>
            One row per product. Columns are case-insensitive. Categories, brands, and suppliers are
            looked up by slug or name (must already exist).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-muted-foreground space-y-1 text-sm">
            <p>
              <strong className="text-foreground">Required:</strong> <code>name</code>
            </p>
            <p>
              <strong className="text-foreground">Optional:</strong> <code>sku</code>,{" "}
              <code>barcode</code>, <code>category</code>, <code>brand</code>, <code>supplier</code>
              , <code>purchase_price</code>, <code>selling_price</code>, <code>vat_code</code>{" "}
              (STD|RED|SEC|LIV|ZER|EXE), <code>vat_included</code>, <code>base_unit</code>,{" "}
              <code>is_active</code>
            </p>
          </div>
          <Button type="button" variant="outline" onClick={handleDownloadTemplate}>
            <FileText className="size-4" />
            Download template CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Upload or paste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={handleFileChange}
              className="border-input file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 h-9 max-w-sm rounded-md border text-sm file:mr-3 file:h-full file:cursor-pointer file:rounded-l-md file:border-0 file:px-3"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCsvText(TEMPLATE_CSV);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Load example
            </Button>
          </div>

          <Textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="name,sku,barcode,category,brand,supplier,purchase_price,selling_price,vat_code,vat_included,base_unit,is_active"
            rows={10}
            className="font-mono text-xs"
          />

          {serverError ? (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex gap-2">
            <Button onClick={handleParse} disabled={parsePending || csvText.trim().length === 0}>
              {parsePending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Validate CSV
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCsvText("");
                setParseResult(null);
                setServerError(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              disabled={parsePending || commitPending}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {parseResult ? (
        <Card>
          <CardHeader>
            <CardTitle>
              3. Review ({parseResult.summary.total} rows -{" "}
              <span className="text-emerald-700 dark:text-emerald-400">
                {parseResult.summary.valid} valid
              </span>
              , <span className="text-destructive">{parseResult.summary.errors} with errors</span>)
            </CardTitle>
            <CardDescription>
              Only valid rows will be inserted. Fix the errors and re-validate to include them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Sell</TableHead>
                  <TableHead className="w-32 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parseResult.rows.slice(0, 200).map((r) => (
                  <TableRow key={r.rowNumber} className={r.ok ? "" : "bg-destructive/5"}>
                    <TableCell className="text-muted-foreground text-center text-xs">
                      {r.rowNumber}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {r.payload?.name ?? r.raw.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.payload?.sku ?? r.raw.sku ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.payload?._category?.name ?? r.raw.category ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.payload?._brand?.name ?? r.raw.brand ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.payload?._supplier?.name ?? r.raw.supplier ?? "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {r.payload?.sellingPrice?.toFixed(2) ?? r.raw.selling_price ?? "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.ok ? (
                        <Badge className="gap-1">
                          <CheckCircle2 className="size-3" />
                          OK
                        </Badge>
                      ) : (
                        <span className="text-destructive inline-flex items-start gap-1 text-left text-xs">
                          <AlertCircle className="mt-0.5 size-3 shrink-0" />
                          {r.error}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {parseResult.rows.length > 200 ? (
              <p className="text-muted-foreground p-4 text-xs">
                Showing first 200 rows. The full set will still be imported.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-muted-foreground text-sm">
                Ready to import <strong>{parseResult.summary.valid}</strong> products.
              </p>
              <Button
                onClick={handleCommit}
                disabled={commitPending || parseResult.summary.valid === 0}
              >
                {commitPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Import {parseResult.summary.valid} products
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
