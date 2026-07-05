"use client";

import { useState } from "react";

/**
 * Mobile sidebar wrapper (Phase 11 responsive pass, PLAN.md §16 F).
 *
 * The desktop layout uses a `fixed` 220px sidebar with `ml-[220px]` on the
 * main content (see (app)/layout.tsx). Below `md`, that fixed width doesn't
 * collapse and crowds/overflows the content (confirmed via a 375px-wide
 * screenshot during the Phase 11 responsive spot-check). This is a light,
 * minimal treatment — not a redesign:
 *
 * - Below `md`: the sidebar is hidden off-canvas by default (`-translate-x-full`)
 *   and slides in as a full-height overlay when toggled, with a scrim behind
 *   it to close on outside-tap. The main content takes full width (no
 *   `ml-[220px]`) and a small top bar (rendered by the parent Server
 *   Component) exposes a hamburger button that calls `onOpen`.
 * - At `md` and up: behaves exactly as before (fixed, always visible,
 *   `ml-[220px]` on the content) — this component becomes a no-op passthrough
 *   at that breakpoint via `md:translate-x-0 md:static`.
 *
 * Kept as a single small client component (not the whole layout) so the
 * parent `(app)/layout.tsx` stays a Server Component with `requireSession()`.
 */
export default function MobileSidebar({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile-only top bar: hamburger + wordmark. Hidden at md+ where the
          real sidebar is always visible and this would be redundant. */}
      <div className="flex items-center gap-3 bg-[#141322] px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-white hover:bg-white/10"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-xs font-bold text-white"
          style={{ background: "linear-gradient(135deg, #2dd4bf, #3b82f6)" }}
          aria-hidden
        >
          T
        </span>
        <span className="text-base font-semibold text-white">Tally</span>
      </div>

      {/* Scrim, mobile-only, only rendered while open. */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar itself: off-canvas + slide-in on mobile, static/fixed at md+. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col gap-8 bg-[#141322] py-6 transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {children}
      </aside>
    </>
  );
}
