"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Sidebar nav items (PLAN.md §16). Items whose pages exist are real links;
 * items for future phases (Reports -> not yet specced beyond this,
 * Settings -> Phase 8) are rendered visually but inert (no href,
 * `aria-disabled`, muted) so there are no dead 404 links. Budgets ->
 * Phase 6, now wired to a real page.
 */
type NavItem = {
  label: string;
  href: string | null;
  soon?: boolean;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    label: "Transactions",
    href: "/expenses",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7h13l-3-3M21 17H8l3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Categories",
    href: "/categories",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="7" cy="7" r="3" />
        <circle cx="17" cy="7" r="3" />
        <circle cx="7" cy="17" r="3" />
        <circle cx="17" cy="17" r="3" />
      </svg>
    ),
  },
  {
    label: "Budgets",
    href: "/budgets",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Reports",
    href: null,
    soon: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19V9M12 19V5M20 19v-7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: null,
    soon: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => {
        const active = item.href != null && pathname.startsWith(item.href);

        if (!item.href) {
          return (
            <span
              key={item.label}
              aria-disabled="true"
              title="Coming soon"
              className="flex cursor-not-allowed items-center justify-between rounded-[8px] px-3 py-2.5 text-sm font-medium text-[#5a5770] select-none"
            >
              <span className="flex items-center gap-3">
                {item.icon}
                {item.label}
              </span>
              {item.soon && (
                <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#5a5770] uppercase">
                  Soon
                </span>
              )}
            </span>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-white/10 text-white"
                : "text-[#9aa0b4] hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
