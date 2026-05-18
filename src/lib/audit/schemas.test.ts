import { describe, expect, it } from "vitest";
import { diffSnapshots } from "@/lib/audit/schemas";

/**
 * Locks in the contract our `/audit` UI relies on:
 *   - `created_at` / `updated_at` are noise and must NEVER appear in a diff.
 *   - The result is sorted by field name so two equivalent updates render
 *     identically and review logs stay deterministic.
 *   - Deep-ish equality (via JSON.stringify) so `{a:1}` does not look like
 *     a change vs. `{a:1}` even though they are different references.
 */
describe("diffSnapshots", () => {
  it("returns an empty array when before equals after", () => {
    expect(diffSnapshots({ name: "Tesco", price: 1.5 }, { name: "Tesco", price: 1.5 })).toEqual([]);
  });

  it("ignores noisy timestamp fields", () => {
    const out = diffSnapshots(
      { name: "Tesco", updated_at: "2026-05-01T00:00:00Z", created_at: "2026-04-01" },
      { name: "Tesco", updated_at: "2026-05-17T11:00:00Z", created_at: "2026-04-02" },
    );
    expect(out).toEqual([]);
  });

  it("captures changed primitives", () => {
    const out = diffSnapshots({ name: "Tesco", price: 1.5 }, { name: "Tesco", price: 1.99 });
    expect(out).toEqual([{ field: "price", before: 1.5, after: 1.99 }]);
  });

  it("captures inserts and deletes (one-sided keys)", () => {
    const out = diffSnapshots({ name: "Tesco" }, { name: "Tesco", barcode: "5391000000001" });
    expect(out).toEqual([{ field: "barcode", before: undefined, after: "5391000000001" }]);

    const out2 = diffSnapshots({ name: "Tesco", legacy: true }, { name: "Tesco" });
    expect(out2).toEqual([{ field: "legacy", before: true, after: undefined }]);
  });

  it("treats deeply equal objects as unchanged via JSON equality", () => {
    expect(diffSnapshots({ tags: ["a", "b"] }, { tags: ["a", "b"] })).toEqual([]);
    const out = diffSnapshots({ tags: ["a"] }, { tags: ["a", "b"] });
    expect(out).toEqual([{ field: "tags", before: ["a"], after: ["a", "b"] }]);
  });

  it("returns multiple diffs sorted by field name", () => {
    const out = diffSnapshots(
      { name: "Old", barcode: null, price: 1.0 },
      { name: "New", barcode: "x", price: 2.0 },
    );
    expect(out.map((d) => d.field)).toEqual(["barcode", "name", "price"]);
  });

  it("handles null / undefined inputs gracefully", () => {
    expect(diffSnapshots(null, null)).toEqual([]);
    expect(diffSnapshots(null, { name: "x" })).toEqual([
      { field: "name", before: undefined, after: "x" },
    ]);
    expect(diffSnapshots({ name: "x" }, undefined)).toEqual([
      { field: "name", before: "x", after: undefined },
    ]);
  });
});
