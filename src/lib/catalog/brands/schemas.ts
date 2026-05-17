import { z } from "zod";

export const brandNameSchema = z
  .string()
  .min(1, "Name is required")
  .max(120, "Name is too long")
  .transform((v) => v.trim());

export const brandSlugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(80, "Slug is too long")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single dashes only");

export const createBrandSchema = z.object({
  name: brandNameSchema,
  slug: z
    .string()
    .max(80)
    .optional()
    .transform((v) => (v ? v.trim().toLowerCase() : v)),
});

export const updateBrandSchema = z.object({
  id: z.string().uuid("Invalid id"),
  name: brandNameSchema,
  slug: brandSlugSchema,
  isActive: z.boolean(),
});

export const toggleBrandSchema = z.object({
  id: z.string().uuid("Invalid id"),
});

export interface BrandRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
