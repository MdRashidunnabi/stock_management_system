import { z } from "zod";
import { entityIdSchema } from "@/lib/entity-id";

export const adjustStockSchema = z
  .object({
    branchId: entityIdSchema,
    productId: entityIdSchema,
    reason: z
      .string()
      .max(500)
      .optional()
      .transform((v) => (v ? v.trim() : "")),
    mode: z.enum(["delta", "set"]),
    delta: z.coerce.number().optional(),
    newQuantity: z.coerce.number().min(0, "Quantity cannot be negative").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "delta") {
      if (data.delta === undefined || !Number.isFinite(data.delta) || data.delta === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a non-zero change (e.g. +10 or -2)",
          path: ["delta"],
        });
      }
      if (data.delta !== undefined && (data.delta < -99999 || data.delta > 99999)) {
        ctx.addIssue({ code: "custom", message: "Change is too large", path: ["delta"] });
      }
    } else if (data.newQuantity === undefined || !Number.isFinite(data.newQuantity)) {
      ctx.addIssue({
        code: "custom",
        message: "Enter the new stock count",
        path: ["newQuantity"],
      });
    }
  });

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export interface ProductBranchStockRow {
  branchId: string;
  branchCode: string;
  branchName: string;
  availableQty: number;
}
