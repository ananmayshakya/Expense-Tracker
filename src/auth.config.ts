import type { NextAuthConfig } from "next-auth";

import { SUPPORTED_CURRENCY_CODES } from "@/lib/currency";
import { THEME_VALUES, type ThemeValue } from "@/lib/validations";

/**
 * Edge/proxy-safe Auth.js base config.
 *
 * IMPORTANT: this file must NEVER import Prisma or bcrypt. It is spread into
 * the full config in `src/auth.ts`, but it is also imported directly by
 * `src/proxy.ts` (Next.js 16's renamed `middleware.ts`) to build a
 * lightweight "is there a session token" check. Keep it free of Node-only
 * dependencies so it stays safe to run in restricted runtimes.
 *
 * `@/lib/currency` and `@/lib/validations` (imported above for the update
 * allowlist below) are plain constants/Zod schemas with no Prisma/bcrypt/
 * Node-only imports — safe here. Verified: neither file imports
 * `@/lib/prisma`, `@/generated/prisma/*`, or `bcryptjs`.
 *
 * The `providers` array is intentionally empty here — the real Credentials
 * provider (which needs Prisma + bcrypt) is added in `src/auth.ts`.
 */

const SUPPORTED_CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCY_CODES);
const THEME_SET = new Set<string>(THEME_VALUES);

function isSupportedCurrency(value: unknown): value is string {
  return typeof value === "string" && SUPPORTED_CURRENCY_SET.has(value);
}

function isValidTheme(value: unknown): value is ThemeValue {
  return typeof value === "string" && THEME_SET.has(value);
}

export default {
  pages: {
    signIn: "/login",
  },
  providers: [],
  session: {
    strategy: "jwt",
    // §17 "JWT role/existence staleness" (hardened Phase 11): the JWT
    // caches `role` at issuance and isn't re-checked against the DB on
    // every request (requireSession/most reads). A demoted or deleted
    // user's token still authenticates until it expires. NextAuth's
    // default maxAge is 30 days, which is a long staleness window.
    // Shortening it to 24h is defense-in-depth: it bounds how long a
    // demoted/deleted account's old token stays valid, without requiring a
    // DB round-trip per request. The admin surface additionally gets a
    // hard, immediate DB re-check regardless of token age (see
    // requireAdmin() in lib/permissions.ts) — this maxAge only helps the
    // non-admin-surface residual risk that's otherwise left undefended.
    // UX tradeoff: users are signed out and must log back in after 24h of
    // token age (note: Auth.js also rolls the expiry forward on activity
    // within that window by default, so active users aren't interrupted
    // mid-session — only fully idle sessions expire at the 24h mark).
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    // Injects id/role/currency/theme into the token. When `user` is present
    // (only on initial sign-in), copy the fields from the object returned by
    // `authorize()` in the Credentials provider (see src/auth.ts).
    //
    // SECURITY (PLAN.md §7, Phase 8): when `trigger === "update"`, `session`
    // is the arbitrary, client-supplied payload passed to
    // `useSession().update(payload)` (see @auth/core's jwt callback types —
    // "you should validate this data before using it"). This is the ONLY
    // place a client can influence the token after initial sign-in, so it
    // is treated as fully untrusted input:
    //
    //  - Only three fields are EVER merged from it: `currency` (must be one
    //    of SUPPORTED_CURRENCY_CODES), `theme` (must be one of
    //    light|dark|system), and `name` (must be a string).
    //  - `role`, `id`, and `email` are NEVER read from `session` here —
    //    there is no code path in this callback that copies them from the
    //    update payload, so a call like
    //    `update({ role: "ADMIN", id: "...", email: "..." })` has zero
    //    effect on `token.role`/`token.id`/`token.email`. Those fields are
    //    only ever set from `user` (the trusted `authorize()` result) on
    //    initial sign-in, above.
    //  - Anything else in the payload (unknown keys, wrong types, invalid
    //    enum values) is silently ignored rather than merged.
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.currency = user.currency;
        token.theme = user.theme;
      }

      if (trigger === "update" && session && typeof session === "object") {
        const payload = session as Record<string, unknown>;

        if (isSupportedCurrency(payload.currency)) {
          token.currency = payload.currency;
        }
        if (isValidTheme(payload.theme)) {
          token.theme = payload.theme;
        }
        if (typeof payload.name === "string") {
          token.name = payload.name;
        }
        // role/id/email intentionally never read from `payload` — see the
        // security note above. This is what makes role-escalation via
        // update() impossible.
      }

      return token;
    },
    // Mirrors the token fields onto session.user so server components/route
    // handlers can read session.user.role, .currency, .theme directly.
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.currency = token.currency;
        session.user.theme = token.theme;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
