import { describe, expect, it } from "vitest";
import { adjustStockSchema } from "./schemas";

describe("adjustStockSchema", () => {
  const base = {
    branchId: "00000000-0000-0000-0000-000000000011",
    productId: "00000000-0000-0000-0000-000000000001",
    reason: "Shelf count",
  };

  it("accepts set mode", () => {
    const r = adjustStockSchema.safeParse({ ...base, mode: "set", newQuantity: 12 });
    expect(r.success).toBe(true);
  });

  it("accepts delta mode", () => {
    const r = adjustStockSchema.safeParse({ ...base, mode: "delta", delta: -2 });
    expect(r.success).toBe(true);
  });

  it("rejects zero delta", () => {
    const r = adjustStockSchema.safeParse({ ...base, mode: "delta", delta: 0 });
    expect(r.success).toBe(false);
  });

  it("accepts empty reason", () => {
    const r = adjustStockSchema.safeParse({
      branchId: base.branchId,
      productId: base.productId,
      mode: "set",
      newQuantity: 5,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.reason).toBe("");
  });
});
