import { requireSession } from "@/lib/permissions";

/**
 * Layout for the authenticated `(app)` route group. `requireSession()`
 * redirects to /login if there's no session — this is a defense-in-depth
 * check alongside the proxy (Next 16's renamed middleware), per the Next.js
 * authentication guide's warning that layouts don't re-render on client
 * navigations, so this alone would not be sufficient without proxy-level
 * (or per-page) coverage. Real per-page/server-action ownership checks are
 * added in later phases as CRUD lands.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return <div className="min-h-screen bg-zinc-50 dark:bg-black">{children}</div>;
}
