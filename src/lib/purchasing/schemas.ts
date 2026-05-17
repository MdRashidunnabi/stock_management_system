import { z } from "zod";

/* ============================== Purchase orders ============================== */

export const VAT_CODES = ["STD", "RED", "SEC", "LIV", "ZER", "EXE"] as const;
export type VatCode = (typeof VAT_CODES)[number];

export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "submitted",
  "partially_received",
  "received",
  "cancelled",
  "closed",
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const GOODS_RECEIPT_STATUSES = ["draft", "finalised", "cancelled"] as const;
export type GoodsReceiptStatus = (typeof GOODS_RECEIPT_STATUSES)[number];

export const purchaseOrderItemInput = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  unitCost: z.coerce.number().min(0, "Unit cost cannot be negative."),
  vatCode: z.enum(VAT_CODES).optional(),
  notes: z.string().max(500).nullish(),
});
export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemInput>;

export const createPurchaseOrderSchema = z.object({
  branchId: z.string().uuid("Choose a branch."),
  supplierId: z.string().uuid("Choose a supplier."),
  expectedAt: z.string().date().nullish(),
  notes: z.string().max(2000).nullish(),
  items: z.array(purchaseOrderItemInput).min(1, "Add at least one line."),
});
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const updatePurchaseOrderStatusSchema = z.object({
  poId: z.string().uuid(),
  newStatus: z.enum(["submitted", "cancelled"]),
});
export type UpdatePurchaseOrderStatusInput = z.infer<typeof updatePurchaseOrderStatusSchema>;

/* ============================== Goods receipts ============================== */

export const goodsReceiptItemInput = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  unitCost: z.coerce.number().min(0, "Unit cost cannot be negative."),
  vatCode: z.enum(VAT_CODES).optional(),
  expiryDate: z.string().date().nullish(),
  lotNo: z.string().max(120).nullish(),
  notes: z.string().max(500).nullish(),
});
export type GoodsReceiptItemInput = z.infer<typeof goodsReceiptItemInput>;

export const createGoodsReceiptSchema = z.object({
  branchId: z.string().uuid("Choose a branch."),
  supplierId: z.string().uuid("Choose a supplier."),
  purchaseOrderId: z.string().uuid().nullish(),
  invoiceNumber: z.string().max(120).nullish(),
  invoiceTotal: z.coerce.number().min(0).nullish(),
  receivedAt: z.string().nullish(),
  notes: z.string().max(2000).nullish(),
  items: z.array(goodsReceiptItemInput).min(1, "Add at least one line."),
});
export type CreateGoodsReceiptInput = z.infer<typeof createGoodsReceiptSchema>;

export const finaliseGoodsReceiptSchema = z.object({
  grId: z.string().uuid(),
});
export type FinaliseGoodsReceiptInput = z.infer<typeof finaliseGoodsReceiptSchema>;

/* ================================ Read shapes =============================== */

export interface SupplierLite {
  id: string;
  name: string;
  code: string | null;
}

export interface BranchLite {
  id: string;
  name: string;
  code: string | null;
}

export interface ProductLite {
  id: string;
  name: string;
  sku: string | null;
  base_unit: string;
  purchase_price: number | null;
  vat_code: VatCode;
  default_supplier_id: string | null;
}

export interface PurchaseOrderListRow {
  id: string;
  po_number: string;
  status: PurchaseOrderStatus;
  total: number;
  vat_total: number;
  expected_at: string | null;
  ordered_at: string | null;
  created_at: string;
  branch: BranchLite | null;
  supplier: SupplierLite | null;
  items_count: number;
}

export interface PurchaseOrderItemRow {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_cost: number;
  vat_code: VatCode;
  qty_received: number;
  qty_outstanding: number;
  line_subtotal: number;
  notes: string | null;
}

export interface PurchaseOrderFullRow extends PurchaseOrderListRow {
  tenant_id: string;
  subtotal: number;
  notes: string | null;
  currency: string;
  approved_at: string | null;
  items: PurchaseOrderItemRow[];
}

export interface GoodsReceiptListRow {
  id: string;
  gr_number: string;
  status: GoodsReceiptStatus;
  received_at: string;
  invoice_number: string | null;
  invoice_total: number | null;
  finalised_at: string | null;
  branch: BranchLite | null;
  supplier: SupplierLite | null;
  purchase_order_id: string | null;
  po_number: string | null;
  items_count: number;
}

export interface GoodsReceiptItemRow {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_cost: number;
  vat_code: VatCode;
  expiry_date: string | null;
  lot_no: string | null;
  notes: string | null;
}

export interface GoodsReceiptFullRow extends GoodsReceiptListRow {
  tenant_id: string;
  notes: string | null;
  items: GoodsReceiptItemRow[];
}
