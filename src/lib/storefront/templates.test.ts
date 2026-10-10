import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHOP_TEMPLATE,
  SHOP_TEMPLATE_IDS,
  SHOP_TEMPLATES,
  getShopTemplate,
  parseShopTemplateId,
} from "./templates";

describe("shop templates", () => {
  it("has ten Needs shop colours", () => {
    expect(SHOP_TEMPLATE_IDS).toHaveLength(10);
    expect(SHOP_TEMPLATES).toHaveLength(10);
    expect(new Set(SHOP_TEMPLATES.map((t) => t.id)).size).toBe(10);
    expect(getShopTemplate("needs").name).toBe("Needs Green");
    expect(getShopTemplate("noir").nav).toBe("side");
    expect(getShopTemplate("blossom").header).toBe("bar");
  });

  it("falls back to Market for unknown ids", () => {
    expect(parseShopTemplateId("unknown")).toBe(DEFAULT_SHOP_TEMPLATE);
    expect(getShopTemplate(null).id).toBe("market");
    expect(getShopTemplate("noir").name).toBe("Noir");
  });
});
