import { describe, expect, it } from "vitest";
import {
  VOUCHER_VALID_DAYS,
  earnedVoucherAmount,
  eligibleSpend,
  orderTotalAfterVoucher,
  voucherDiscount,
  voucherDeadline,
} from "./rules";

describe("voucher rules", () => {
  it("earns the next voucher on the amount left after the discount", () => {
    const products = 30;
    const discount = voucherDiscount(10, products);
    expect(discount).toBe(10);
    const eligible = eligibleSpend(products, discount);
    expect(eligible).toBe(20);
    expect(earnedVoucherAmount(eligible)).toBe(1);
    expect(orderTotalAfterVoucher(products, 4.99, discount)).toBe(24.99);
  });

  it("does not discount delivery and does not let a voucher exceed the products", () => {
    expect(voucherDiscount(10, 6)).toBe(6);
    expect(eligibleSpend(6, 6)).toBe(0);
    expect(earnedVoucherAmount(0)).toBe(0);
    expect(orderTotalAfterVoucher(6, 4.99, 6)).toBe(4.99);
  });

  it("shows a voucher for a small basket", () => {
    expect(earnedVoucherAmount(1.69)).toBe(0.08);
    expect(earnedVoucherAmount(9)).toBe(0.45);
    expect(earnedVoucherAmount(0)).toBe(0);
  });

  it("sets the deadline 30 days after the voucher is issued", () => {
    const issued = new Date("2026-10-10T12:00:00Z");
    const deadline = voucherDeadline(issued);
    expect(VOUCHER_VALID_DAYS).toBe(30);
    expect(deadline.toISOString().slice(0, 10)).toBe("2026-11-09");
  });
});
