import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/auth";

/**
 * Authorization helpers per PLAN.md §7.
 *
 * The rule: identity is ALWAYS derived from the server-verified session,
 * never from client-supplied input (e.g. a `userId` in a request body).
 */

/**
 * Returns the current session, or redirects to /login if there isn't one.
 * Use in Server Components / layouts / pages that require auth.
 */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

/**
 * Requires the current session to belong to an ADMIN. Redirects unauth'd
 * users to /login, and throws a 403 Error for authenticated non-admins
 * (callers in Server Components can let this propagate to an error
 * boundary; Route Handlers should catch and translate to a 403 response).
 */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") {
    throw new ForbiddenError("Admin role required.");
  }
  return session;
}

/**
 * Ownership check used by every mutation/read of a user-owned resource.
 * Allows the resource owner OR an admin; throws otherwise.
 *
 * `resourceUserId` must come from the database record being acted on —
 * NEVER from client input — and `session` must come from `requireSession()`.
 */
export function assertOwnerOrAdmin(resourceUserId: string, session: Session): void {
  const isOwner = session.user.id === resourceUserId;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError("You do not have access to this resource.");
  }
}

/**
 * Thrown by `requireAdmin` / `assertOwnerOrAdmin` when an authenticated
 * user is not permitted to perform the action. Route Handlers should catch
 * this and respond with 403.
 */
export class ForbiddenError extends Error {
  status = 403 as const;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}
