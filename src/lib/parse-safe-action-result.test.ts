import { describe, expect, it } from "vitest";
import { getSafeActionData, getSafeActionError } from "./parse-safe-action-result";

describe("getSafeActionError", () => {
  it("ignores empty validationErrors objects", () => {
    expect(
      getSafeActionError({ data: { ok: true, sessionId: "x" }, validationErrors: {} }),
    ).toBeNull();
  });

  it("ignores zod-style empty _errors", () => {
    expect(
      getSafeActionError({
        data: { ok: true, rows: [] },
        validationErrors: { _errors: [] },
      }),
    ).toBeNull();
  });

  it("reports real field errors", () => {
    expect(
      getSafeActionError({
        validationErrors: { branchId: { _errors: ["Pick a branch"] } },
      }),
    ).toBe("Please check the form fields.");
  });
});

describe("getSafeActionData", () => {
  it("reads success payloads", () => {
    expect(
      getSafeActionData<{ ok: true; sessionId: string }>({
        data: { ok: true, sessionId: "abc" },
      }),
    ).toEqual({ ok: true, sessionId: "abc" });
  });
});
