"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setUserRole } from "@/actions/admin";
import type { Role } from "@/generated/prisma/client";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  expenseCount: number;
  createdAt: string;
};

const buttonSecondary =
  "rounded-[8px] border border-[#e4ddcf] px-3 py-1.5 text-sm font-medium text-[#1c1a17] transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3a355a] dark:text-white dark:hover:bg-white/5";

function RoleBadge({ role }: { role: Role }) {
  const isAdmin = role === "ADMIN";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isAdmin
          ? "bg-[#3b82f6]/15 text-[#3b82f6]"
          : "bg-black/5 text-[#6f6a60] dark:bg-white/10 dark:text-[#9aa0b4]"
      }`}
    >
      {role}
    </span>
  );
}

function RoleControl({
  row,
  isSelf,
  adminCount,
}: {
  row: UserRow;
  isSelf: boolean;
  adminCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isAdmin = row.role === "ADMIN";
  // Client-side hint only — the SERVER action re-checks the real admin
  // count regardless (see src/actions/admin.ts). This just disables the
  // button so an admin doesn't attempt (and get rejected by) an obviously
  // doomed demote-the-last-admin click.
  const wouldOrphan = isAdmin && adminCount <= 1;

  function handleClick() {
    setError(null);
    const nextRole: Role = isAdmin ? "USER" : "ADMIN";
    startTransition(async () => {
      const result = await setUserRole(row.id, nextRole);
      if (!result.ok) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || wouldOrphan}
        title={wouldOrphan ? "You can't remove the last admin." : undefined}
        className={buttonSecondary}
      >
        {pending ? "Saving..." : isAdmin ? "Demote to USER" : "Promote to ADMIN"}
      </button>
      {isSelf && <span className="text-[10px] text-[#6f6a60] dark:text-[#9aa0b4]">(you)</span>}
      {error && (
        <p className="max-w-[220px] text-right text-xs text-[#ef4444]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function AdminClient({
  rows,
  currentUserId,
  adminCount,
}: {
  rows: UserRow[];
  currentUserId: string;
  adminCount: number;
}) {
  return (
    <div className="overflow-x-auto rounded-[12px] border border-[#e4ddcf] bg-[#fffdf8] dark:border-[#3a355a] dark:bg-[#272341]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-[#e4ddcf] text-xs font-semibold uppercase tracking-wide text-[#6f6a60] dark:border-[#3a355a] dark:text-[#9aa0b4]">
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3"># Expenses</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[#e4ddcf] last:border-0 dark:border-[#3a355a]"
            >
              <td className="px-4 py-3 text-[#1c1a17] dark:text-white">{row.email}</td>
              <td className="px-4 py-3 text-[#1c1a17] dark:text-white">{row.name ?? "—"}</td>
              <td className="px-4 py-3">
                <RoleBadge role={row.role} />
              </td>
              <td className="px-4 py-3 text-[#1c1a17] dark:text-white">{row.expenseCount}</td>
              <td className="px-4 py-3 text-[#6f6a60] dark:text-[#9aa0b4]">{row.createdAt}</td>
              <td className="px-4 py-3">
                <RoleControl
                  row={row}
                  isSelf={row.id === currentUserId}
                  adminCount={adminCount}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
