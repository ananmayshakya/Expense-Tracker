import { requireSession } from "@/lib/permissions";

import SettingsClient from "./SettingsClient";

/**
 * Settings page (§9.9, Phase 8). Server Component: `requireSession()` per
 * the established pattern, then hand the current user's display fields
 * (name/email/currency/theme — all sourced from the session, never a fresh
 * DB read that could diverge from what the client believes it has) to the
 * client component, which owns the four sections (profile, password,
 * currency, theme) and their react-hook-form + Zod validation.
 */
export default async function SettingsPage() {
  const session = await requireSession();
  const { user } = session;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-[#1c1a17] dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-[#6f6a60] dark:text-[#9aa0b4]">
          Manage your profile, password, currency, and theme.
        </p>
      </div>

      <SettingsClient
        name={user.name ?? ""}
        email={user.email ?? ""}
        currency={user.currency}
        theme={user.theme}
      />
    </div>
  );
}
