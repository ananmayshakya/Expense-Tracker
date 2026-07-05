"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  updateCurrencySchema,
  updatePasswordSchema,
  updateProfileSchema,
  updateThemeSchema,
} from "@/lib/validations";

/**
 * Settings server actions (PLAN.md §9.9, Phase 8, §7 security model).
 *
 * SELF-SERVICE ONLY: every action here operates exclusively on
 * `session.user.id` — the identity derived from `requireSession()`. There is
 * no `userId` parameter anywhere in this file, by design: these actions can
 * never be pointed at another user's row, so there's no ownership check to
 * perform (unlike categories/expenses/budgets/recurring, which accept a
 * resource id and must verify ownership). Do NOT add a userId parameter to
 * any of these without re-deriving it from the session.
 *
 * After a DB write, the JWT/session (which carries currency/theme at
 * sign-in) is stale until the client calls `useSession().update(...)`. That
 * trigger is handled by the `jwt` callback in `src/auth.config.ts`, which
 * enforces a strict allowlist (currency/theme/name only — never role/id/
 * email) so a forged `update({ role: "ADMIN" })` cannot escalate privilege.
 * See that file for the allowlist implementation.
 */

export type SettingsActionResult<Fields extends string = never> =
  | { ok: true }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<Record<Fields, string[]>>;
    };

/**
 * Updates the current user's display name. Email is intentionally NOT
 * editable this phase (display-only, per the Phase 8 brief).
 */
export async function updateProfile(
  input: { name?: string }
): Promise<SettingsActionResult<"name">> {
  const session = await requireSession();

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const name = parsed.data.name && parsed.data.name.length > 0 ? parsed.data.name : null;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name },
  });

  // The shell's greeting header (src/app/(app)/layout.tsx) reads the name
  // from the session, so every page under (app) needs to re-render once the
  // client refreshes the session via update({ name }) + router.refresh().
  revalidatePath("/", "layout");

  return { ok: true };
}

/**
 * Changes the current user's password. Requires the correct current
 * password (bcrypt.compare against the stored hash) before accepting a new
 * one. Never returns `passwordHash` or any hint beyond a generic mismatch
 * error.
 */
export async function updatePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<SettingsActionResult<"currentPassword" | "newPassword">> {
  const session = await requireSession();

  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) {
    // Should be unreachable (session implies the user row exists), but
    // fail closed rather than throwing a raw 500.
    return { ok: false, error: "Account not found." };
  }

  const currentMatches = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!currentMatches) {
    return {
      ok: false,
      error: "Current password is incorrect.",
      fieldErrors: { currentPassword: ["Current password is incorrect."] },
    };
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: newHash },
  });

  return { ok: true };
}

/**
 * Updates the current user's display currency. Rejects any code not in
 * SUPPORTED_CURRENCY_CODES (the Zod enum below already enforces this, but
 * the schema itself is the single source of truth so there's no separate
 * check needed here).
 */
export async function updateCurrency(input: {
  currency: string;
}): Promise<SettingsActionResult<"currency">> {
  const session = await requireSession();

  const parsed = updateCurrencySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please choose a supported currency.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { currency: parsed.data.currency },
  });

  // Every page that formats money reads session.user.currency — revalidate
  // all of them so a currency change reformats amounts app-wide as soon as
  // the client refreshes the session + calls router.refresh().
  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  revalidatePath("/budgets");
  revalidatePath("/recurring");

  return { ok: true };
}

/**
 * Updates the current user's theme preference (light/dark/system),
 * persisted to `User.theme` so it survives login on a different device
 * (PLAN.md §16). next-themes' own localStorage handles same-device
 * persistence; this is the DB half of that story.
 */
export async function updateTheme(input: {
  theme: string;
}): Promise<SettingsActionResult<"theme">> {
  const session = await requireSession();

  const parsed = updateThemeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please choose a valid theme.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { theme: parsed.data.theme },
  });

  revalidatePath("/", "layout");

  return { ok: true };
}
