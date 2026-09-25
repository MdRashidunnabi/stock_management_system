import { describe, expect, it } from "vitest";
import { emptyHidScanState, feedHidScan, looksLikeBarcode } from "./hid-scanner";

function burst(keys: string[], start = 1_000, gap = 8) {
  let state = emptyHidScanState();
  let complete: string | null = null;
  keys.forEach((key, i) => {
    const result = feedHidScan(state, key, start + i * gap);
    state = result.state;
    if (result.complete) complete = result.complete;
  });
  return { state, complete };
}

describe("feedHidScan", () => {
  it("completes a wireless scanner burst plus Enter", () => {
    const { complete } = burst([
      "5",
      "3",
      "9",
      "1",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
      "1",
      "Enter",
    ]);
    expect(complete).toBe("5391000000001");
  });

  it("ignores slow human typing", () => {
    let state = emptyHidScanState();
    state = feedHidScan(state, "5", 1000, { maxIntervalMs: 45 }).state;
    state = feedHidScan(state, "3", 1200, { maxIntervalMs: 45 }).state;
    const done = feedHidScan(state, "Enter", 1400, { maxIntervalMs: 45 });
    expect(done.complete).toBeNull();
  });

  it("does not treat a short Enter as a scan", () => {
    const { complete } = burst(["1", "2", "Enter"]);
    expect(complete).toBeNull();
  });
});

describe("looksLikeBarcode", () => {
  it("accepts EAN-style codes", () => {
    expect(looksLikeBarcode("5391000000001")).toBe(true);
    expect(looksLikeBarcode("ab")).toBe(false);
  });
});
