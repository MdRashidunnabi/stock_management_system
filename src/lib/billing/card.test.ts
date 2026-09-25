import { describe, expect, it } from "vitest";
import {
  detectCardBrand,
  formatCardNumber,
  formatExpiryInput,
  isExpiryInFuture,
  isValidCardNumber,
  isValidCvc,
  luhnCheck,
  parseExpiry,
} from "@/lib/billing/card";

describe("card validation", () => {
  it("accepts well-formed Visa, Mastercard, Amex, and Discover numbers", () => {
    expect(detectCardBrand("4242424242424242")).toBe("visa");
    expect(isValidCardNumber("4242 4242 4242 4242")).toBe(true);
    expect(detectCardBrand("5555555555554444")).toBe("mastercard");
    expect(isValidCardNumber("5555555555554444")).toBe(true);
    expect(detectCardBrand("378282246310005")).toBe("amex");
    expect(isValidCardNumber("3782 822463 10005")).toBe(true);
    expect(detectCardBrand("6011111111111117")).toBe("discover");
    expect(isValidCardNumber("6011111111111117")).toBe(true);
  });

  it("rejects numbers that fail Luhn or brand length", () => {
    expect(luhnCheck("4242424242424241")).toBe(false);
    expect(isValidCardNumber("4242424242424241")).toBe(false);
    expect(isValidCardNumber("1234")).toBe(false);
    expect(isValidCardNumber("")).toBe(false);
  });

  it("formats PAN by brand", () => {
    expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242");
    expect(formatCardNumber("378282246310005")).toBe("3782 822463 10005");
  });

  it("checks CVC length by brand and future expiry", () => {
    expect(isValidCvc("123", "visa")).toBe(true);
    expect(isValidCvc("1234", "amex")).toBe(true);
    expect(isValidCvc("123", "amex")).toBe(false);
    expect(isExpiryInFuture("12", "99")).toBe(true);
    expect(isExpiryInFuture("01", "20")).toBe(false);
    expect(isExpiryInFuture("13", "29")).toBe(false);
  });

  it("parses MM / YY as the user types", () => {
    expect(formatExpiryInput("1")).toBe("1");
    expect(formatExpiryInput("12")).toBe("12");
    expect(formatExpiryInput("1228")).toBe("12 / 28");
    expect(parseExpiry("12 / 28")).toEqual({ month: "12", year: "28" });
  });
});
