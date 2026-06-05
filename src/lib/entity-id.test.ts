import { describe, expect, it } from "vitest";
import { entityIdSchema } from "./entity-id";

describe("entityIdSchema", () => {
  it("accepts Needscarlow demo branch id", () => {
    expect(entityIdSchema.safeParse("00000000-0000-0000-0000-000000000011").success).toBe(true);
  });

  it("rejects non-uuid strings", () => {
    expect(entityIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});
