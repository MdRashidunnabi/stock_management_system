import { z } from "zod";

export const STAFF_INVITE_ROLES = ["manager", "cashier", "accountant", "warehouse"] as const;

export const createInviteSchema = z.object({
  email: z.string().email().max(200),
  role: z.enum(STAFF_INVITE_ROLES),
  branchId: z.string().uuid().optional().or(z.literal("")),
});

export const revokeInviteSchema = z.object({
  inviteId: z.string().uuid(),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(16).max(128),
});

export const STAFF_LOGIN_ROLES = ["manager", "cashier", "accountant"] as const;

const staffPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters, with a letter and a number.")
  .max(72, "That password is too long.")
  .regex(/[A-Za-z]/, "Use at least 8 characters, with a letter and a number.")
  .regex(/\d/, "Use at least 8 characters, with a letter and a number.");

export const createStaffLoginSchema = z.object({
  email: z.string().email().max(200),
  password: staffPasswordSchema,
  role: z.enum(STAFF_LOGIN_ROLES),
});

export const setStaffPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: staffPasswordSchema,
});

export const removeStaffSchema = z.object({
  userId: z.string().uuid(),
});
