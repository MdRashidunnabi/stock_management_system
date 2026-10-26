import { describe, expect, it } from "vitest";
import {
  DEFAULT_DELIVERY_AREAS,
  calculateDeliveryQuote,
  deliveryAreasFromNotes,
  quoteDeliveryArea,
  withDeliveryAreas,
} from "@/lib/storefront/delivery";

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

  it("uses the Carlow and outside-Carlow charges", () => {
    const [carlow, outside] = DEFAULT_DELIVERY_AREAS;
    expect(carlow?.minOrder).toBe(20);
    expect(quoteDeliveryArea(25, "delivery", carlow!).fee).toBe(3.99);
    expect(outside?.minOrder).toBe(50);
    expect(quoteDeliveryArea(60, "delivery", outside!).fee).toBe(5.99);
    const notes = withDeliveryAreas("hello", DEFAULT_DELIVERY_AREAS);
    expect(deliveryAreasFromNotes(notes)[0]?.name).toContain("Carlow");
    expect(notes).toContain("hello");
  });
});
