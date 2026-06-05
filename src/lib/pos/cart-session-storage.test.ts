import { afterEach, describe, expect, it } from "vitest";
import { clearPosCart, loadPosCart, savePosCart } from "./cart-session-storage";
import type { CartLine } from "./schemas";

const TENANT = "00000000-0000-0000-0000-000000000002";
const BRANCH = "00000000-0000-0000-0000-000000000011";

const LINE: CartLine = {
  productId: "aa38fb6e-76bf-4b3e-86ac-ce8584f6f610",
  name: "Test item",
  sku: "NC-FOOD-0002",
  barcode: null,
  baseUnit: "un",
  unitPrice: 2.49,
  vatCode: "STD",
  vatIncluded: true,
  qty: 2,
  discount: 0,
};

afterEach(() => {
  clearPosCart(TENANT, BRANCH);
});

describe("cart session storage", () => {
  it("round-trips cart lines per tenant and branch", () => {
    savePosCart(TENANT, BRANCH, [LINE]);
    expect(loadPosCart(TENANT, BRANCH)).toEqual([LINE]);
  });

  it("clears when cart is empty", () => {
    savePosCart(TENANT, BRANCH, [LINE]);
    savePosCart(TENANT, BRANCH, []);
    expect(loadPosCart(TENANT, BRANCH)).toEqual([]);
  });
});
