import Link from "next/link";

import MobileSidebar from "@/components/MobileSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import SidebarNav from "@/components/SidebarNav";
import UserMenu from "@/components/UserMenu";
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
 *
 * Responsive (Phase 11 F): below `md` the 220px sidebar would otherwise
 * crowd/overflow the content (confirmed at 375px width), so it's wrapped in
 * `MobileSidebar` (a small client component) which slides it off-canvas by
 * default on mobile with a hamburger toggle, and renders it exactly as
 * before (fixed, always visible) at `md` and up. The main content's
 * `ml-[220px]` similarly only applies at `md+` (`md:ml-[220px]`).
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
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Sidebar — hardcoded dark palette, unaffected by theme (§16).
          MobileSidebar handles the off-canvas/slide-in behavior below `md`;
          at `md+` it renders fixed and always visible, same as before. */}
      <MobileSidebar>
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

        <SidebarNav isAdmin={user.role === "ADMIN"} />
      </MobileSidebar>

      {/* Main area */}
      <div className="flex min-h-screen flex-1 flex-col bg-[#f4efe4] dark:bg-[#1b1930] md:ml-[220px]">
        <header className="flex flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-8">
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
            <UserMenu displayName={displayName} email={user.email ?? ""} initial={initial} />
          </div>
        </header>

        <main className="flex-1 px-4 pb-10 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
