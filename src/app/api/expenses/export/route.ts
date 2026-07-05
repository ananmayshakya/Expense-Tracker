import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/currency";
import { buildExpenseQuery, parseExpenseFilters, searchParamsFromUrl } from "@/lib/expense-query";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

/**
 * CSV export (§9.7): `GET /api/expenses/export` streams the CALLER's
 * expenses as a CSV, respecting the same filters/scoping as the Phase 4
 * expenses page (`buildExpenseQuery`/`parseExpenseFilters` — shared with
 * `src/app/(app)/expenses/page.tsx`). An admin may export another user's
 * expenses via `?userId=<id>` — gated strictly to ADMIN (§7).
 *
 * IMPORTANT (route-handler auth): `src/proxy.ts`'s matcher EXCLUDES `/api`
 * (see its `config.matcher`), so this handler does NOT get the proxy's
 * redirect-to-/login guard for free. It must authenticate itself. A Route
 * Handler cannot "redirect" cleanly the way a Server Component can (there's
 * no browser navigation context for an XHR/fetch/download), so on missing
 * auth we return a plain 401 JSON response instead of calling
 * `requireSession()` (which would call `next/navigation`'s `redirect()` —
 * appropriate for pages, not for a file-download endpoint).
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const requestedUserId = request.nextUrl.searchParams.get("userId");

  // --- §7 admin gate -------------------------------------------------
  // No `userId` param -> caller exports their own data (self-service,
  // always allowed). ANY `userId` param present -> the caller must be
  // ADMIN, even if the id supplied is their own — a non-admin explicitly
  // asking for "userId=<anything>" is treated as an attempted privilege
  // check and rejected outright, not silently downgraded to self-export.
  let targetUserId: string;
  if (requestedUserId === null) {
    targetUserId = session.user.id;
  } else {
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    targetUserId = requestedUserId;
  }

  // Resolve the target user's currency for correct money formatting.
  // Self-export: reuse the session's currency (no extra DB round-trip).
  // Admin export-for-other: fetch the target user's currency for real —
  // never assume/reuse the admin's own currency.
  let targetCurrency: string;
  if (targetUserId === session.user.id) {
    targetCurrency = session.user.currency;
  } else {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { currency: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    targetCurrency = targetUser.currency;
  }

  // --- Filters: identical construction to the expenses page -----------
  let filters;
  try {
    filters = parseExpenseFilters(searchParamsFromUrl(request.nextUrl.searchParams));
  } catch {
    return NextResponse.json({ error: "Invalid filter parameters." }, { status: 400 });
  }

  const { where, orderBy } = buildExpenseQuery(targetUserId, filters);

  const expenses = await prisma.expense.findMany({
    where,
    orderBy,
    select: {
      amount: true,
      description: true,
      date: true,
      category: { select: { name: true } },
    },
  });

  const csv = buildCsv(expenses, targetCurrency);

  const filename = `expenses-${todayStamp()}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

type ExportRow = {
  amount: Prisma.Decimal;
  description: string;
  date: Date;
  category: { name: string } | null;
};

function buildCsv(rows: ExportRow[], currency: string): string {
  const header = ["Date", "Description", "Category", "Amount"];
  const lines = [header.map(csvField).join(",")];

  for (const row of rows) {
    // Date pinned to en-US, consistent with every other date display in
    // the app (ExpensesClient/RecurringClient date labels, PLAN.md §17).
    const dateLabel = row.date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const categoryLabel = row.category?.name ?? "Uncategorized";
    const amountLabel = formatMoney(decimalToString(row.amount), currency);

    lines.push(
      [csvField(dateLabel), csvField(row.description), csvField(categoryLabel), csvField(amountLabel)].join(
        ","
      )
    );
  }

  // Trailing newline is conventional for CSV files.
  return lines.join("\r\n") + "\r\n";
}

/**
 * Formats a single CSV field: neutralizes CSV-formula injection, then
 * applies RFC 4180 escaping. Order matters — the formula guard must run
 * BEFORE quoting, since it inspects the field's leading character.
 *
 * Formula-injection guard (OWASP CSV Injection guidance): if the field
 * starts with `=`, `+`, `-`, `@`, a tab, or a carriage return, spreadsheet
 * apps (Excel, Google Sheets, LibreOffice) may interpret the cell as a
 * formula when opened. Prefixing with a single quote (`'`) neutralizes
 * this — Excel/Sheets render the field as literal text instead of
 * evaluating it, and the leading `'` is not visible in the rendered cell.
 *
 * RFC 4180 escaping: any field containing a comma, double-quote, CR, or
 * LF must be wrapped in double quotes, with any internal double-quote
 * doubled (`"` -> `""`).
 */
function csvField(value: string): string {
  let field = value;

  if (/^[=+\-@\t\r]/.test(field)) {
    field = `'${field}`;
  }

  if (/[",\r\n]/.test(field)) {
    field = `"${field.replace(/"/g, '""')}"`;
  }

  return field;
}

/** Today's date as YYYYMMDD, UTC-stable (en-US/ISO-based, no locale drift). */
function todayStamp(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}
