"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import {
  createExpense,
  deleteExpense,
  updateExpense,
  type ExpenseActionResult,
} from "@/actions/expenses";
import { formatMoney } from "@/lib/currency";
import { expenseSchema, type ExpenseFormInput, type ExpenseInput } from "@/lib/validations";

type Category = { id: string; name: string; color: string };

type Expense = {
  id: string;
  amount: string;
  description: string;
  date: string; // ISO string
  categoryId: string | null;
  category: Category | null;
};

type Filters = {
  categoryIds: string[];
  dateFrom: string;
  dateTo: string;
  search: string;
  sortBy: "date" | "amount";
  sortDir: "asc" | "desc";
};

const inputClasses =
  "rounded-[8px] border border-[#e4ddcf] bg-[#fffdf8] px-3 py-2 text-sm text-[#1c1a17] outline-none focus:border-[#3b82f6] dark:border-[#3a355a] dark:bg-[#272341] dark:text-white";

const buttonPrimary =
  "rounded-[8px] bg-[#1c1a17] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-[#1c1a17]";

const buttonSecondary =
  "rounded-[8px] border border-[#e4ddcf] px-3 py-1.5 text-sm font-medium text-[#1c1a17] transition-colors hover:bg-black/5 dark:border-[#3a355a] dark:text-white dark:hover:bg-white/5";

function toFormValues(expense?: Expense): ExpenseFormInput {
  if (!expense) {
    return {
      amount: "",
      description: "",
      date: new Date().toISOString().slice(0, 10),
      categoryId: null,
    };
  }
  return {
    amount: expense.amount,
    description: expense.description,
    date: expense.date.slice(0, 10),
    categoryId: expense.categoryId,
  };
}

function ExpenseForm({
  categories,
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  categories: Category[];
  defaultValues: ExpenseFormInput;
  onSubmit: (data: ExpenseInput) => Promise<ExpenseActionResult>;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ExpenseFormInput, unknown, ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues,
  });

  const submit = handleSubmit((data) => {
    setFormError(null);
    startTransition(async () => {
      const result = await onSubmit(data);
      if (!result.ok) {
        setFormError(result.error);
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages && messages.length > 0) {
              setError(field as keyof ExpenseFormInput, { message: messages[0] });
            }
          }
        }
      } else {
        router.refresh();
      }
    });
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1">
        <label htmlFor="amount" className="text-sm font-medium text-[#1c1a17] dark:text-white">
          Amount
        </label>
        <input
          id="amount"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          {...register("amount")}
          className={`${inputClasses} w-28`}
        />
        {errors.amount && (
          <p className="text-xs text-[#ef4444]" role="alert">
            {errors.amount.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="description"
          className="text-sm font-medium text-[#1c1a17] dark:text-white"
        >
          Description
        </label>
        <input
          id="description"
          type="text"
          maxLength={200}
          {...register("description")}
          className={`${inputClasses} w-48`}
        />
        {errors.description && (
          <p className="text-xs text-[#ef4444]" role="alert">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-[#1c1a17] dark:text-white">
          Date
        </label>
        <input id="date" type="date" {...register("date")} className={`${inputClasses} w-40`} />
        {errors.date && (
          <p className="text-xs text-[#ef4444]" role="alert">
            {errors.date.message as string}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="categoryId" className="text-sm font-medium text-[#1c1a17] dark:text-white">
          Category
        </label>
        <select id="categoryId" {...register("categoryId")} className={`${inputClasses} w-40`}>
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <p className="text-xs text-[#ef4444]" role="alert">
            {errors.categoryId.message}
          </p>
        )}
      </div>

      {formError && (
        <p className="w-full text-sm text-[#ef4444]" role="alert">
          {formError}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function ExpenseRow({ expense, categories, currency }: {
  expense: Expense;
  categories: Category[];
  currency: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (editing) {
    return (
      <tr>
        <td colSpan={5} className="p-4">
          <ExpenseForm
            categories={categories}
            defaultValues={toFormValues(expense)}
            submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            onSubmit={async (data) => {
              const result = await updateExpense(expense.id, data);
              if (result.ok) setEditing(false);
              return result;
            }}
          />
        </td>
      </tr>
    );
  }

  // Use a fixed locale ("en-US") rather than the runtime default: the
  // server and the browser can have different default locales, which
  // causes a hydration mismatch (server renders "Jul 4, 2026", client
  // renders "4 Jul 2026"). A fixed locale keeps SSR and client output
  // identical.
  const dateLabel = new Date(expense.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <tr className="border-b border-[#e4ddcf] last:border-0 dark:border-[#3a355a]">
      <td className="whitespace-nowrap px-4 py-3 text-sm text-[#1c1a17] dark:text-white">
        {dateLabel}
      </td>
      <td className="px-4 py-3 text-sm text-[#1c1a17] dark:text-white">{expense.description}</td>
      <td className="px-4 py-3">
        {expense.category ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: expense.category.color }}
          >
            {expense.category.name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-[#6f6a60] dark:bg-white/10 dark:text-[#9aa0b4]">
            Uncategorized
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-[#1c1a17] dark:text-white">
        {formatMoney(expense.amount, currency)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        {confirmingDelete ? (
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-[#6f6a60] dark:text-[#9aa0b4]">Delete?</span>
            <button
              type="button"
              disabled={deletePending}
              onClick={() => {
                setDeleteError(null);
                startDeleteTransition(async () => {
                  const result = await deleteExpense(expense.id);
                  if (!result.ok) {
                    setDeleteError(result.error);
                    setConfirmingDelete(false);
                  } else {
                    router.refresh();
                  }
                });
              }}
              className="rounded-[8px] bg-[#ef4444] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
            >
              {deletePending ? "Deleting..." : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className={buttonSecondary}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setEditing(true)} className={buttonSecondary}>
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-[8px] border border-[#e4ddcf] px-3 py-1.5 text-sm font-medium text-[#ef4444] transition-colors hover:bg-[#ef4444]/10 dark:border-[#3a355a]"
            >
              Delete
            </button>
          </div>
        )}
        {deleteError && (
          <p className="mt-1 text-xs text-[#ef4444]" role="alert">
            {deleteError}
          </p>
        )}
      </td>
    </tr>
  );
}

function FilterBar({ categories, filters }: { categories: Category[]; filters: Filters }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const exportHref = `/api/expenses/export?${searchParams.toString()}`;

  function updateParams(next: Partial<Record<string, string | string[] | undefined>>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      params.delete(key);
      if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, v);
      } else {
        params.set(key, value);
      }
    }
    router.push(`/expenses?${params.toString()}`);
  }

  function toggleCategory(id: string) {
    const next = filters.categoryIds.includes(id)
      ? filters.categoryIds.filter((c) => c !== id)
      : [...filters.categoryIds, id];
    updateParams({ categoryIds: next });
  }

  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-[#e4ddcf] bg-[#fffdf8] p-4 dark:border-[#3a355a] dark:bg-[#272341]">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#6f6a60] dark:text-[#9aa0b4]">Search</span>
          <input
            type="text"
            defaultValue={filters.search}
            placeholder="Search description..."
            onChange={(e) => updateParams({ search: e.target.value })}
            className={`${inputClasses} w-52`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#6f6a60] dark:text-[#9aa0b4]">From</span>
          <input
            type="date"
            defaultValue={filters.dateFrom}
            onChange={(e) => updateParams({ dateFrom: e.target.value })}
            className={`${inputClasses} w-40`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#6f6a60] dark:text-[#9aa0b4]">To</span>
          <input
            type="date"
            defaultValue={filters.dateTo}
            onChange={(e) => updateParams({ dateTo: e.target.value })}
            className={`${inputClasses} w-40`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#6f6a60] dark:text-[#9aa0b4]">Sort by</span>
          <select
            defaultValue={filters.sortBy}
            onChange={(e) => updateParams({ sortBy: e.target.value })}
            className={`${inputClasses} w-32`}
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#6f6a60] dark:text-[#9aa0b4]">Order</span>
          <select
            defaultValue={filters.sortDir}
            onChange={(e) => updateParams({ sortDir: e.target.value })}
            className={`${inputClasses} w-28`}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>

        {(filters.categoryIds.length > 0 ||
          filters.dateFrom ||
          filters.dateTo ||
          filters.search) && (
          <button
            type="button"
            onClick={() => router.push("/expenses")}
            className={`${buttonSecondary} self-end`}
          >
            Clear filters
          </button>
        )}

        <a href={exportHref} className={`${buttonSecondary} self-end`}>
          Export CSV
        </a>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#6f6a60] dark:text-[#9aa0b4]">Category</span>
          {categories.map((c) => {
            const active = filters.categoryIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategory(c.id)}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-white transition-opacity"
                style={{ backgroundColor: c.color, opacity: active ? 1 : 0.35 }}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ExpensesClient({
  initialExpenses,
  categories,
  currency,
  initialFilters,
}: {
  initialExpenses: Expense[];
  categories: Category[];
  currency: string;
  initialFilters: Filters;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <FilterBar categories={categories} filters={initialFilters} />

      <div className="rounded-[12px] border border-[#e4ddcf] bg-[#fffdf8] p-4 dark:border-[#3a355a] dark:bg-[#272341]">
        {showCreate ? (
          <ExpenseForm
            categories={categories}
            defaultValues={toFormValues()}
            submitLabel="Add expense"
            onCancel={() => setShowCreate(false)}
            onSubmit={async (data) => {
              const result = await createExpense(data);
              if (result.ok) setShowCreate(false);
              return result;
            }}
          />
        ) : (
          <button type="button" onClick={() => setShowCreate(true)} className={buttonPrimary}>
            + Add expense
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-[12px] border border-[#e4ddcf] bg-[#fffdf8] dark:border-[#3a355a] dark:bg-[#272341]">
        {initialExpenses.length === 0 ? (
          <p className="p-4 text-sm text-[#6f6a60] dark:text-[#9aa0b4]">
            No expenses match the current filters.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#e4ddcf] text-left text-xs font-medium uppercase tracking-wide text-[#6f6a60] dark:border-[#3a355a] dark:text-[#9aa0b4]">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialExpenses.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  categories={categories}
                  currency={currency}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
