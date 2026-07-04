import type { NextAuthConfig } from "next-auth";

/**
 * Edge/proxy-safe Auth.js base config.
 *
 * IMPORTANT: this file must NEVER import Prisma or bcrypt. It is spread into
 * the full config in `src/auth.ts`, but it is also imported directly by
 * `src/proxy.ts` (Next.js 16's renamed `middleware.ts`) to build a
 * lightweight "is there a session token" check. Keep it free of Node-only
 * dependencies so it stays safe to run in restricted runtimes.
 *
 * The `providers` array is intentionally empty here — the real Credentials
 * provider (which needs Prisma + bcrypt) is added in `src/auth.ts`.
 */
export default {
  pages: {
    signIn: "/login",
  },
  providers: [],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // Injects id/role/currency/theme into the token. When `user` is present
    // (only on initial sign-in), copy the fields from the object returned by
    // `authorize()` in the Credentials provider (see src/auth.ts).
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.currency = user.currency;
        token.theme = user.theme;
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
