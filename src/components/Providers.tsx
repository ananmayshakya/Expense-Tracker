"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

/**
 * Client-side context providers for the whole app (PLAN.md §16 / §8).
 *
 * - `ThemeProvider` (next-themes): `attribute="class"` toggles `class="dark"`
 *   on <html>, which is what the `@custom-variant dark` rule in
 *   globals.css keys off of for Tailwind v4. `enableSystem` follows the OS
 *   preference until the user picks explicitly; next-themes persists the
 *   choice to localStorage itself for same-device reloads.
 *
 *   `defaultTheme` is passed in by the root layout (Server Component),
 *   seeded from `session.user.theme` (falling back to `"system"` when
 *   there's no session, e.g. on the auth pages) — Phase 8, PLAN.md §16
 *   ("persist to User.theme so it survives login on other devices"). This
 *   only matters on a FRESH device/browser with empty localStorage:
 *   next-themes reads `localStorage` first if a value is already stored
 *   there, and only falls back to `defaultTheme` otherwise, so same-device
 *   reloads keep behaving exactly as before.
 * - `SessionProvider` (next-auth/react): lets client components call
 *   `useSession()` / `signIn()` / `signOut()` without prop-drilling the
 *   session. Server Components still get the session via `auth()`
 *   directly (no context needed there). The `session` is SEEDED from the
 *   root layout's server-side `auth()` call so the provider does NOT do an
 *   on-mount client `getSession()` fetch (that fetch, in the mount
 *   useEffect, is what surfaced transient `ClientFetchError: Failed to
 *   fetch` during dev navigation/HMR when it got aborted). `refetchOnWindowFocus`
 *   is disabled for the same reason — we refresh the session explicitly via
 *   `useSession().update()` after settings/theme changes, so background
 *   refetches aren't needed.
 *
 * Per the Next.js "Server and Client Components" guide, context providers
 * must be Client Components, but should be rendered as deep as reasonably
 * possible — here that's just below <body> in the root layout.
 */
export default function Providers({
  children,
  defaultTheme,
  session,
}: {
  children: React.ReactNode;
  defaultTheme: "light" | "dark" | "system";
  session: Session | null;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme={defaultTheme} enableSystem>
      <SessionProvider session={session} refetchOnWindowFocus={false}>
        {children}
      </SessionProvider>
    </ThemeProvider>
  );
}
