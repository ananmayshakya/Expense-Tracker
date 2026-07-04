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

/**
 * Shared schema for Expense create/edit (§9.2, §10 money discipline).
 * Reused by the server actions in `src/actions/expenses.ts` and by the
 * client form via @hookform/resolvers/zod.
 *
 * `amount` accepts string or number from the client (forms serialize to
 * strings; programmatic callers may pass a number), and is constrained to
 * what fits in a `Decimal(12,2)` column: > 0, at most 2 decimal places,
 * and <= 9,999,999,999.99. Money math itself is done with `Prisma.Decimal`
 * in `lib/money.ts` — this schema only validates shape/range.
 */
const MAX_AMOUNT = 9_999_999_999.99;

export const expenseSchema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .transform((val, ctx) => {
      const num = typeof val === "string" ? Number(val.trim()) : val;
      if (typeof val === "string" && val.trim() === "") {
        ctx.addIssue({ code: "custom", message: "Amount is required." });
        return z.NEVER;
      }
      if (!Number.isFinite(num)) {
        ctx.addIssue({ code: "custom", message: "Amount must be a valid number." });
        return z.NEVER;
      }
      return num;
    })
    .pipe(
      z
        .number()
        .gt(0, { error: "Amount must be greater than zero." })
        .max(MAX_AMOUNT, { error: "Amount is too large." })
        .refine(
          (num) => {
            // At most 2 decimal places. Use string round-trip to avoid
            // float artifacts like 1.005 -> 1.00499999999999989...
            const [, decimals] = num.toString().split(".");
            return !decimals || decimals.length <= 2;
          },
          { error: "Amount can have at most 2 decimal places." }
        )
    ),
  description: z
    .string()
    .trim()
    .min(1, { error: "Description is required." })
    .max(200, { error: "Description must be 200 characters or fewer." }),
  date: z.coerce.date({ error: "Please enter a valid date." }),
  categoryId: z.string().trim().min(1).nullable().optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

/**
 * The PRE-transform/coercion shape (what raw form inputs produce: `amount`
 * as a string, `date` as whatever `z.coerce.date()` accepts e.g. a date
 * string). Use this as the react-hook-form field type; `ExpenseInput`
 * (above) is what the resolver produces after validation/transform, which
 * is what `handleSubmit`'s callback receives.
 */
export type ExpenseFormInput = z.input<typeof expenseSchema>;

/**
 * Shared schema for Budget create/edit (§9.5, §10 money discipline). Reused
 * by the server actions in `src/actions/budgets.ts` and by the client form
 * via @hookform/resolvers/zod. `amount` reuses the same range/precision
 * rules as `expenseSchema` (> 0, at most 2 decimal places, <= Decimal(12,2)
 * max). `categoryId` is `null` for the overall monthly budget.
 */
export const budgetSchema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .transform((val, ctx) => {
      const num = typeof val === "string" ? Number(val.trim()) : val;
      if (typeof val === "string" && val.trim() === "") {
        ctx.addIssue({ code: "custom", message: "Amount is required." });
        return z.NEVER;
      }
      if (!Number.isFinite(num)) {
        ctx.addIssue({ code: "custom", message: "Amount must be a valid number." });
        return z.NEVER;
      }
      return num;
    })
    .pipe(
      z
        .number()
        .gt(0, { error: "Amount must be greater than zero." })
        .max(MAX_AMOUNT, { error: "Amount is too large." })
        .refine(
          (num) => {
            const [, decimals] = num.toString().split(".");
            return !decimals || decimals.length <= 2;
          },
          { error: "Amount can have at most 2 decimal places." }
        )
    ),
  month: z.coerce
    .number()
    .int({ error: "Month must be a whole number." })
    .min(1, { error: "Month must be between 1 and 12." })
    .max(12, { error: "Month must be between 1 and 12." }),
  year: z.coerce
    .number()
    .int({ error: "Year must be a whole number." })
    .min(2000, { error: "Year must be between 2000 and 2100." })
    .max(2100, { error: "Year must be between 2000 and 2100." }),
  categoryId: z.string().trim().min(1).nullable().optional(),
});

export type BudgetInput = z.infer<typeof budgetSchema>;
export type BudgetFormInput = z.input<typeof budgetSchema>;

/**
 * Filters + sort for the expenses list (§9.2). Parsed server-side from URL
 * search params so filtering/sorting is shareable and always applied via
 * Prisma `where`/`orderBy` — never trust the client to have already
 * filtered anything.
 */
export const expenseFilterSchema = z.object({
  categoryIds: z.array(z.string()).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(["date", "amount"]).default("date"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type ExpenseFilterInput = z.infer<typeof expenseFilterSchema>;
