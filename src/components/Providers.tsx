"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

/**
 * Client-side context providers for the whole app (PLAN.md §16 / §8).
 *
 * - `ThemeProvider` (next-themes): `attribute="class"` toggles `class="dark"`
 *   on <html>, which is what the `@custom-variant dark` rule in
 *   globals.css keys off of for Tailwind v4. `defaultTheme="system"` +
 *   `enableSystem` follows the OS preference until the user picks
 *   explicitly; next-themes persists the choice to localStorage itself.
 *   (DB persistence to `User.theme` is deferred to Phase 8 — see
 *   ThemeToggle.tsx.)
 * - `SessionProvider` (next-auth/react): lets client components call
 *   `useSession()` / `signIn()` / `signOut()` without prop-drilling the
 *   session. Server Components still get the session via `auth()`
 *   directly (no context needed there).
 *
 * Per the Next.js "Server and Client Components" guide, context providers
 * must be Client Components, but should be rendered as deep as reasonably
 * possible — here that's just below <body> in the root layout.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SessionProvider>{children}</SessionProvider>
    </ThemeProvider>
  );
}
