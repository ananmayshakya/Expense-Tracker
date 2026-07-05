"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { updateTheme } from "@/actions/settings";

/**
 * Theme toggle (PLAN.md §16 — corrected spec).
 *
 * 60x30px pill, `role="switch"`, 24px white thumb that slides the FULL
 * track width between states (`translateX(0)` <-> `translateX(30px)`).
 * Track color flips per mode; thumb shows an inline SVG moon (dark) / sun
 * (light) — no icon font is installed (rules.md Rule 1: no new deps), so
 * `ti-moon`/`ti-sun` from the mockup are drawn as raw SVG paths instead.
 *
 * Driven by next-themes' `useTheme()`. Per next-themes' own hydration
 * guidance (node_modules/next-themes/README.md "Avoid Hydration
 * Mismatch"), `theme`/`resolvedTheme` are undefined on the server and
 * during the first client render, so we render a static, non-interactive
 * placeholder until `mounted` flips true in an effect (client-only) and
 * only then read/react to the real theme.
 *
 * `resolvedTheme` (not `theme`) drives the switch's on/off visual state so
 * `theme === "system"` still shows the correct effective state.
 *
 * Phase 8: toggling now does three things, in order:
 *  1. `setTheme` (next-themes) — instant visual change + localStorage, same
 *     as before.
 *  2. `updateTheme` server action — persists to `User.theme` (DB) so the
 *     preference follows the user to a fresh device/session (§16).
 *  3. `useSession().update({ theme })` — refreshes the JWT via the
 *     `trigger === "update"` branch of the `jwt` callback in
 *     `src/auth.config.ts` (allowlisted to theme/currency/name only), then
 *     `router.refresh()` so Server Components (e.g. the root layout's
 *     `defaultTheme` seed) see the new session without a re-login.
 * Toggling explicitly only ever sets "light" or "dark" (never "system") —
 * matching the prior behavior; "system" is chosen via the Settings page
 * theme selector, not this pill.
 */
export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const { update } = useSession();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Static placeholder — same footprint, no theme-dependent styling, so
    // there is nothing for the server/client to disagree on.
    return (
      <span
        aria-hidden
        className="inline-block h-[30px] w-[60px] rounded-full bg-[#e4ddcf] dark:bg-[#3a355a]"
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  async function handleToggle() {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    await updateTheme({ theme: next });
    await update({ theme: next });
    router.refresh();
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        void handleToggle();
      }}
      className="relative inline-flex h-[30px] w-[60px] shrink-0 items-center rounded-full transition-colors duration-200"
      style={{ backgroundColor: isDark ? "#3a355a" : "#fbbf24" }}
    >
      <span
        className="absolute left-[3px] flex h-[24px] w-[24px] items-center justify-center rounded-full bg-white text-[#1c1a17] shadow transition-transform duration-200"
        style={{ transform: isDark ? "translateX(30px)" : "translateX(0px)" }}
      >
        {isDark ? (
          // Moon (dark mode)
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          // Sun (light mode)
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        )}
      </span>
    </button>
  );
}
