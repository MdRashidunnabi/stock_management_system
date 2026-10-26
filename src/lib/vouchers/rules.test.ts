import { describe, expect, it } from "vitest";
import {
  DEFAULT_ONLINE_VOUCHER_TIERS,
  DEFAULT_TILL_VOUCHER_TIERS,
  VOUCHER_VALID_DAYS,
  earnedFromTiers,
  earnedVoucherAmount,
  eligibleSpend,
  orderTotalAfterVoucher,
  voucherAmountFromTiers,
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
    expect(voucherAmountFromTiers(eligible, DEFAULT_TILL_VOUCHER_TIERS)).toBe(1);
    expect(earnedVoucherAmount(eligible)).toBe(1);
    expect(orderTotalAfterVoucher(products, 4.99, discount)).toBe(24.99);
  });

  it("does not discount delivery and does not let a voucher exceed the products", () => {
    expect(voucherDiscount(10, 6)).toBe(6);
    expect(eligibleSpend(6, 6)).toBe(0);
    expect(earnedVoucherAmount(0)).toBe(0);
    expect(orderTotalAfterVoucher(6, 4.99, 6)).toBe(4.99);
  });

  it("pays the spend band from the shop table", () => {
    expect(voucherAmountFromTiers(19.99, DEFAULT_TILL_VOUCHER_TIERS)).toBe(0);
    expect(voucherAmountFromTiers(39, DEFAULT_TILL_VOUCHER_TIERS)).toBe(1);
    expect(voucherAmountFromTiers(49, DEFAULT_TILL_VOUCHER_TIERS)).toBe(2);
    expect(voucherAmountFromTiers(79, DEFAULT_TILL_VOUCHER_TIERS)).toBe(3);
    expect(voucherAmountFromTiers(99, DEFAULT_TILL_VOUCHER_TIERS)).toBe(5);
    expect(voucherAmountFromTiers(100, DEFAULT_TILL_VOUCHER_TIERS)).toBe(7);
    expect(voucherAmountFromTiers(49, DEFAULT_ONLINE_VOUCHER_TIERS)).toBe(0);
    expect(voucherAmountFromTiers(50, DEFAULT_ONLINE_VOUCHER_TIERS)).toBe(2);
    expect(voucherAmountFromTiers(100, DEFAULT_ONLINE_VOUCHER_TIERS)).toBe(5);
    expect(earnedFromTiers(80, null, "online")).toBe(3);
  });

  it("sets the deadline 30 days after the voucher is issued", () => {
    const issued = new Date("2026-10-10T12:00:00Z");
    const deadline = voucherDeadline(issued);
    expect(VOUCHER_VALID_DAYS).toBe(30);
    expect(deadline.toISOString().slice(0, 10)).toBe("2026-11-09");
  });
});
