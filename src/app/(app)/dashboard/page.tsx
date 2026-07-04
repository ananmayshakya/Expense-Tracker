import { signOut } from "@/auth";
import { requireSession } from "@/lib/permissions";

/**
 * Placeholder protected page for Phase 2 — proves middleware/proxy
 * protection works and that `role` (plus currency/theme) is present on the
 * session. Real dashboard features (cards, charts) land in Phase 5.
 */
export default async function DashboardPage() {
  const session = await requireSession();
  const { user } = session;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Good to see you, {user.name ?? user.email}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          This is a placeholder dashboard proving the auth + RBAC foundation
          works. Real dashboard features arrive in a later phase.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-200 bg-white p-6 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">{user.email}</dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Role</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">{user.role}</dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Currency</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">{user.currency}</dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Theme</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">{user.theme}</dd>
        </div>
      </dl>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
