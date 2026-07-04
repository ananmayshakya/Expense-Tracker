import { z } from "zod";

/**
 * Shared Zod schemas — the trust boundary for auth-related input.
 * These are reused by the register API route and by client-side forms.
 */

export const passwordSchema = z
  .string()
  .min(8, { error: "Password must be at least 8 characters long." })
  .regex(/[a-zA-Z]/, { error: "Password must contain at least one letter." })
  .regex(/[0-9]/, { error: "Password must contain at least one number." });

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100).optional().or(z.literal("")),
  email: z.email({ error: "Please enter a valid email address." }).trim().toLowerCase(),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email({ error: "Please enter a valid email address." }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Password is required." }),
});

export type LoginInput = z.infer<typeof loginSchema>;
