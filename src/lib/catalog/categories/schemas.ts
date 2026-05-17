import { z } from "zod";

/**
 * Zod schemas + types for the categories module.
 * Imported by the form components AND the server actions.
 */

export const categoryNameSchema = z
  .string()
  .min(1, "Name is required")
  .max(120, "Name is too long")
  .transform((v) => v.trim());

export const categorySlugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(80, "Slug is too long")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single dashes only");

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  slug: z
    .string()
    .max(80)
    .optional()
    .transform((v) => (v ? v.trim().toLowerCase() : v)),
  position: z.coerce.number().int().min(0).max(9999).optional(),
});

export const updateCategorySchema = z.object({
  id: z.string().uuid("Invalid id"),
  name: categoryNameSchema,
  slug: categorySlugSchema,
  position: z.coerce.number().int().min(0).max(9999),
  isActive: z.boolean(),
});

export const archiveCategorySchema = z.object({
  id: z.string().uuid("Invalid id"),
});

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
