import { describe, expect, it } from "vitest";
import { calculateDeliveryQuote } from "@/lib/storefront/delivery";

const settings = { standardFee: 4.99, freeOver: 50, minOrder: 15 };

describe("calculateDeliveryQuote", () => {
  it("charges no fee for takeaway", () => {
    expect(calculateDeliveryQuote(30, "takeaway", settings).fee).toBe(0);
  });

  it("charges standard fee below free-over threshold", () => {
    expect(calculateDeliveryQuote(49.99, "delivery", settings).fee).toBe(4.99);
  });

  it("is free at or above threshold", () => {
    expect(calculateDeliveryQuote(50, "delivery", settings).fee).toBe(0);
    expect(calculateDeliveryQuote(120, "delivery", settings).fee).toBe(0);
  });
});
