import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";
import SidebarNav from "@/components/SidebarNav";
import { requireSession } from "@/lib/permissions";

/**
 * Picks the greeting word by server time (PLAN.md §16: "Good evening,
 * {name}"). Server-rendered so it's correct for the request without a
 * client round-trip; there's no per-user timezone stored (out of scope),
 * so this uses the server's local time.
 */
function greetingForHour(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Layout for the authenticated `(app)` route group — the Tally app shell
 * (PLAN.md §16). Server Component: `requireSession()` is the
 * defense-in-depth check alongside proxy-level protection (see the
 * existing comment history in this file / src/proxy.ts), and it also
 * supplies the name/email/avatar-initial rendered directly from the
 * session, with no client fetch needed.
 *
 * Layout split:
 * - Fixed left sidebar: stays dark (`#141322`) in BOTH light and dark mode
 *   — no `dark:` variants are applied to it, the palette is hardcoded, per
 *   the "sidebar stays dark" rule in §16.
 * - Main area: switches between the light/dark §16 tokens via Tailwind's
 *   `dark:` variant (wired in globals.css via `@custom-variant dark`,
 *   driven by next-themes' `class` attribute on <html> — see
 *   src/components/Providers.tsx).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const { user } = session;

  const displayName = user.name ?? user.email ?? "there";
  const initial = (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase();
  const greeting = greetingForHour(new Date().getHours());

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — hardcoded dark palette, unaffected by theme (§16). */}
      <aside className="fixed inset-y-0 left-0 flex w-[220px] flex-col gap-8 bg-[#141322] py-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-4">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #2dd4bf, #3b82f6)" }}
            aria-hidden
          >
            T
          </span>
          <span className="text-lg font-semibold text-white">Tally</span>
        </Link>

        <SidebarNav />
      </aside>

      {/* Main area */}
      <div className="ml-[220px] flex min-h-screen flex-1 flex-col bg-[#f4efe4] dark:bg-[#1b1930]">
        <header className="flex items-center justify-between gap-4 px-8 py-6">
          <div>
            <h1 className="text-xl font-semibold text-[#1c1a17] dark:text-white">
              {greeting}, {displayName} 👋
            </h1>
            <p className="mt-0.5 text-sm text-[#6f6a60] dark:text-[#9aa0b4]">
              Here&apos;s what&apos;s happening with your money.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <ThemeToggle />
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)" }}
              title={displayName}
              aria-label={`Signed in as ${displayName}`}
            >
              {initial}
            </span>
          </div>
        </header>

        <main className="flex-1 px-8 pb-10">{children}</main>
      </div>
    </div>
  );
}
