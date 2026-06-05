import { z } from "zod";
import { branchCodeSchema, eircodeSchema } from "@/lib/onboarding/schemas";

export const addBranchSchema = z.object({
  code: branchCodeSchema,
  name: z
    .string()
    .min(1)
    .max(120)
    .transform((v) => v.trim()),
  addressLine1: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  county: z.string().max(80).optional(),
  eircode: eircodeSchema,
});
