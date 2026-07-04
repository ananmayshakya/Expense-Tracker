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

/**
 * Shared schema for Category create/edit (§9.3). Reused by the server
 * actions in `src/actions/categories.ts` and by the client form via
 * @hookform/resolvers/zod.
 */
export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Name is required." })
    .max(40, { error: "Name must be 40 characters or fewer." }),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: "Color must be a hex value like #6b7280." }),
});

export type CategoryInput = z.infer<typeof categorySchema>;
