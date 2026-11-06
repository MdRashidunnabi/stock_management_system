import { listStockForExport } from "@/lib/catalog/products/actions";
import { requireRole } from "@/lib/auth/tenant";
import { listBranchesForCurrentTenant } from "@/lib/pos/actions";

const HEADERS = [
  "Name",
  "SKU",
  "Barcode",
  "Category",
  "Brand",
  "Supplier",
  "Available",
  "Unit",
  "Cost",
  "Sell",
  "VAT",
  "VAT included",
  "Status",
];

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: Request) {
  await requireRole(["owner", "manager", "warehouse"]);
  const sp = new URL(request.url).searchParams;
  const statusParam = sp.get("status");
  const status =
    statusParam === "all" || statusParam === "archived" || statusParam === "active"
      ? statusParam
      : "active";

  const branches = await listBranchesForCurrentTenant();
  const branchParam = sp.get("branch");
  const branch = branches.find((b) => b.id === branchParam) ?? branches[0] ?? null;

  const rows = await listStockForExport({
    search: sp.get("q") ?? undefined,
    categoryId: sp.get("category") || null,
    brandId: sp.get("brand") || null,
    supplierId: sp.get("supplier") || null,
    status,
    branchId: branch?.id ?? null,
  });

  const lines = [
    HEADERS,
    ...rows.map((p) => [
      p.name,
      p.sku,
      p.barcode,
      p.category?.name,
      p.brand?.name,
      p.supplier?.name,
      p.available_qty,
      p.base_unit,
      Number(p.purchase_price ?? 0).toFixed(2),
      Number(p.selling_price ?? 0).toFixed(2),
      p.vat_code,
      p.vat_included ? "Yes" : "No",
      p.is_active ? "Active" : "Archived",
    ]),
  ];
  const csv = "\uFEFF" + lines.map((line) => line.map(csvCell).join(",")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  const filename = `products-${branch?.code ?? "all"}-${date}.csv`.replace(/[^A-Za-z0-9._-]/g, "_");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
