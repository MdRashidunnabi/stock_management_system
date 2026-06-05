import { z } from "zod";

/**
 * Zod 4's `.uuid()` rejects deterministic demo IDs used in seeds
 * (e.g. `00000000-0000-0000-0000-000000000011`). Accept any canonical
 * 8-4-4-4-12 hex UUID string instead.
 */
export const entityIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid id");

export type EntityId = z.infer<typeof entityIdSchema>;
