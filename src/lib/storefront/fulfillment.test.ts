import { describe, expect, it } from "vitest";
import {
  fulfillmentStageLabel,
  lineStatusLabel,
  stagesForFulfillment,
} from "@/lib/storefront/fulfillment";

describe("stagesForFulfillment", () => {
  it("uses delivery tracking for home delivery", () => {
    expect(stagesForFulfillment("delivery").map((s) => s.value)).toEqual([
      "preparing",
      "prepared_for_delivery",
      "on_the_way",
      "delivered",
    ]);
  });

  it("uses collection tracking for takeaway", () => {
    expect(stagesForFulfillment("takeaway").map((s) => s.value)).toEqual([
      "preparing",
      "ready_for_collection",
      "collected",
    ]);
  });
});

describe("labels", () => {
  it("names stages and line outcomes", () => {
    expect(fulfillmentStageLabel("on_the_way")).toBe("On the way");
    expect(fulfillmentStageLabel("ready_for_collection")).toBe("Ready for collection");
    expect(lineStatusLabel("substituted")).toBe("Similar product sent");
    expect(lineStatusLabel("refunded")).toBe("Not sent · refunded");
  });
});
