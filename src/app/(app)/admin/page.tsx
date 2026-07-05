import { redirect } from "next/navigation";

import { ForbiddenError, requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import AdminClient from "./AdminClient";

/**
 * Admin panel (PLAN.md §9.8, §7 security model). Server Component.
 *
 * SERVER-SIDE ADMIN ENFORCEMENT (§7): `requireAdmin()` redirects an
 * unauthenticated visitor to /login, and throws `ForbiddenError` for an
 * authenticated non-admin. We catch that ForbiddenError here and redirect
 * to /dashboard instead of letting it bubble up as an unhandled 500 — so a
 * USER hitting /admin gets a clean redirect and NEVER receives the user
 * table in the rendered payload (the DB query below only runs after the
 * admin check has already passed).
 */
export default async function AdminPage() {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/dashboard");
    }
    throw error;
  }

  // Only reachable for a verified ADMIN. Select ONLY the fields the table
  // displays plus the relation count — never passwordHash or other
  // sensitive fields.
  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { expenses: true } },
    },
  });

  const adminCount = users.filter((u) => u.role === "ADMIN").length;

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    expenseCount: u._count.expenses,
    // Fixed locale (en-US), consistent with the date-label pins elsewhere
    // in the app (ExpensesClient/RecurringClient/dashboard) to avoid a
    // server/client locale hydration mismatch.
    createdAt: u.createdAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-[#1c1a17] dark:text-white">Admin</h1>
        <p className="mt-1 text-sm text-[#6f6a60] dark:text-[#9aa0b4]">
          Manage user roles. {adminCount} admin{adminCount === 1 ? "" : "s"} currently.
        </p>
      </div>

      <AdminClient
        rows={rows}
        currentUserId={session.user.id}
        adminCount={adminCount}
      />
    </div>
  );
}
