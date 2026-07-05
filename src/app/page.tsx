import { redirect } from "next/navigation";

import { auth } from "@/auth";

/**
 * Root route (PLAN.md §14 Phase 11 acceptance: "fresh clone works end to
 * end"). This replaces create-next-app's default boilerplate page.
 *
 * `src/proxy.ts` already redirects unauthenticated visitors to `/login` for
 * every non-API route (including `/`), so in practice the proxy handles the
 * unauthenticated case before this component ever renders. This Server
 * Component adds the authenticated-branch redirect (`/` -> `/dashboard`)
 * and, for defense-in-depth consistent with the rest of the app's
 * server-side checks (e.g. `requireSession`/`requireAdmin`), re-derives the
 * destination from a real `auth()` call rather than assuming the proxy ran.
 */
export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  redirect("/login");
}
