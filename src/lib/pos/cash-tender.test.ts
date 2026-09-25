import { describe, expect, it } from "vitest";
import { appendCashKey, evaluateCashTender, parseCashBuffer } from "@/lib/pos/cash-tender";

describe("evaluateCashTender", () => {
  it("exact note needs no change", () => {
    expect(evaluateCashTender(12.5, 12.5)).toEqual({
      due: 12.5,
      given: 12.5,
      change: 0,
      short: 0,
      enough: true,
    });
  });

  it("a €50 note on €37.60 due gives €12.40 back", () => {
    const r = evaluateCashTender(37.6, 50);
    expect(r.enough).toBe(true);
    expect(r.change).toBe(12.4);
    expect(r.short).toBe(0);
  });

  it("a small note shows how much is still due", () => {
    const r = evaluateCashTender(37.6, 20);
    expect(r.enough).toBe(false);
    expect(r.change).toBe(0);
    expect(r.short).toBe(17.6);
  });
});

describe("cash keypad", () => {
  it("types 50 then 00 as 50.00", () => {
    let buf = "";
    for (const k of ["5", "0", ".", "0", "0"]) buf = appendCashKey(buf, k);
    expect(parseCashBuffer(buf)).toBe(50);
    expect(buf).toBe("50.00");
  });

  it("caps at two decimal places", () => {
    expect(appendCashKey("12.34", "5")).toBe("12.34");
  });

  it("backspace and clear", () => {
    expect(appendCashKey("12", "back")).toBe("1");
    expect(appendCashKey("12.5", "clear")).toBe("");
  });
});

describe("stacked notes", () => {
  it("adds short notes until the sale is covered", () => {
    const first = evaluateCashTender(37.6, 20);
    expect(first.enough).toBe(false);
    expect(first.short).toBe(17.6);
    const second = evaluateCashTender(37.6, 40);
    expect(second.enough).toBe(true);
    expect(second.change).toBe(2.4);
  });
});
