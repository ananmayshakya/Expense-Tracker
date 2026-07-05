"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

/**
 * Header avatar → dropdown with account info + sign out. Previously the
 * avatar was a static, non-interactive badge with no way to sign out at all
 * (`signOut` was exported from `auth.ts` but never called anywhere in the
 * UI). Click-outside-to-close uses an invisible full-screen backdrop, same
 * pattern as `MobileSidebar`'s scrim.
 */
export default function UserMenu({
  displayName,
  email,
  initial,
}: {
  displayName: string;
  email: string;
  initial: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Signed in as ${displayName}. Open account menu`}
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
        style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)" }}
      >
        {initial}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />

          <div
            role="menu"
            className="absolute right-0 top-11 z-50 w-56 rounded-[12px] border border-[#e4ddcf] bg-[#fffdf8] p-2 shadow-lg dark:border-[#3a355a] dark:bg-[#272341]"
          >
            <div className="border-b border-[#e4ddcf] px-3 py-2 dark:border-[#3a355a]">
              <p className="truncate text-sm font-medium text-[#1c1a17] dark:text-white">
                {displayName}
              </p>
              <p className="truncate text-xs text-[#6f6a60] dark:text-[#9aa0b4]">{email}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                void signOut({ callbackUrl: "/login" });
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
