import { z } from "zod";

/**
 * Shared auth-related Zod schemas. Used by both server actions (validation)
 * and client forms (react-hook-form resolvers) so the contract is identical.
 */

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .max(254, "Email is too long")
  .transform((v) => v.trim().toLowerCase());

/**
 * Password rules - intentionally mild for an MVP. Tighten in production.
 *  - 8 chars min, 72 max (bcrypt limit Supabase uses internally)
 *  - at least one letter and one digit
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long (max 72 characters)")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/\d/, "Password must contain at least one number");

export const fullNameSchema = z
  .string()
  .min(1, "Your name is required")
  .max(120, "Name is too long")
  .transform((v) => v.trim());

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
  next: z.string().optional(),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
  marketingOptIn: z.boolean().optional(),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const setActiveTenantSchema = z.object({
  tenantId: z.string().uuid("Invalid tenant id"),
});
