"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { deleteBudget, setBudget, type BudgetActionResult } from "@/actions/budgets";
import { formatMoney } from "@/lib/currency";
import { budgetSchema, type BudgetFormInput, type BudgetInput } from "@/lib/validations";

type Category = { id: string; name: string; color: string };

type OverallBudget = { id: string; amount: string } | null;

type CategoryBudget = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  amount: string; // budget amount, stringified Decimal
  spent: string; // spent this month, stringified Decimal
};

const OVER_BUDGET_COLOR = "#ef4444";

const inputClasses =
  "rounded-[8px] border border-[#e4ddcf] bg-[#fffdf8] px-3 py-2 text-sm text-[#1c1a17] outline-none focus:border-[#3b82f6] dark:border-[#3a355a] dark:bg-[#272341] dark:text-white";

const buttonPrimary =
  "rounded-[8px] bg-[#1c1a17] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-[#1c1a17]";

const buttonSecondary =
  "rounded-[8px] border border-[#e4ddcf] px-3 py-1.5 text-sm font-medium text-[#1c1a17] transition-colors hover:bg-black/5 dark:border-[#3a355a] dark:text-white dark:hover:bg-white/5";

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Budget progress bar (§16: "Budget bars: track = subtle neutral; fill =
 * category color; over-budget fill turns red (#ef4444) regardless of
 * category color"). Comparison of spent vs budget is done by the caller
 * using `Prisma.Decimal`-derived strings parsed back with `Number` ONLY
 * for the 0-100 width percentage (a purely cosmetic value) — the
 * true/false "is over budget" boolean is computed server-side/at the
 * call site from Decimal math, not floats, and passed in as `isOverBudget`.
 */
function BudgetBar({
  spent,
  budget,
  isOverBudget,
  fillColor,
  currency,
}: {
  spent: string;
  budget: string;
  isOverBudget: boolean;
  fillColor: string;
  currency: string;
}) {
  const spentNum = Number(spent);
  const budgetNum = Number(budget);
  const pct = budgetNum > 0 ? Math.min(100, (spentNum / budgetNum) * 100) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[#1c1a17] dark:text-white">
          {formatMoney(spent, currency)} of {formatMoney(budget, currency)}
        </span>
        <span
          className={`text-xs font-semibold ${
            isOverBudget ? "text-[#ef4444]" : "text-[#6f6a60] dark:text-[#9aa0b4]"
          }`}
        >
          {budgetNum > 0 ? `${((spentNum / budgetNum) * 100).toFixed(0)}%` : "—"}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: isOverBudget ? OVER_BUDGET_COLOR : fillColor,
          }}
        />
      </div>
      {isOverBudget && (
        <p className="text-xs font-medium text-[#ef4444]" role="alert">
          Over budget by {formatMoney((spentNum - budgetNum).toFixed(2), currency)}
        </p>
      )}
    </div>
  );
}

function MonthYearPicker({ month, year }: { month: number; year: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(nextMonth: number, nextYear: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", String(nextMonth));
    params.set("year", String(nextYear));
    router.push(`/budgets?${params.toString()}`);
  }

  function prevMonth() {
    if (month === 1) go(12, year - 1);
    else go(month - 1, year);
  }

  function nextMonth() {
    if (month === 12) go(1, year + 1);
    else go(month + 1, year);
  }

  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={prevMonth} className={buttonSecondary} aria-label="Previous month">
        ←
      </button>
      <span className="min-w-[140px] text-center text-sm font-semibold text-[#1c1a17] dark:text-white">
        {MONTH_LABELS[month - 1]} {year}
      </span>
      <button type="button" onClick={nextMonth} className={buttonSecondary} aria-label="Next month">
        →
      </button>
    </div>
  );
}

function BudgetFormFields({
  categories,
  register,
  errors,
  showCategory,
}: {
  categories: Category[];
  register: ReturnType<typeof useForm<BudgetFormInput, unknown, BudgetInput>>["register"];
  errors: ReturnType<typeof useForm<BudgetFormInput, unknown, BudgetInput>>["formState"]["errors"];
  showCategory: boolean;
}) {
  return (
    <>
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
          className={`${inputClasses} w-32`}
        />
        {errors.amount && (
          <p className="text-xs text-[#ef4444]" role="alert">
            {errors.amount.message as string}
          </p>
        )}
      </div>

      {showCategory && (
        <div className="flex flex-col gap-1">
          <label htmlFor="categoryId" className="text-sm font-medium text-[#1c1a17] dark:text-white">
            Category
          </label>
          <select id="categoryId" {...register("categoryId")} className={`${inputClasses} w-44`}>
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.categoryId && (
            <p className="text-xs text-[#ef4444]" role="alert">
              {errors.categoryId.message as string}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function OverallBudgetSection({
  month,
  year,
  currency,
  overallBudget,
  overallSpent,
}: {
  month: number;
  year: number;
  currency: string;
  overallBudget: OverallBudget;
  overallSpent: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(overallBudget === null);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<BudgetFormInput, unknown, BudgetInput>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      amount: overallBudget?.amount ?? "",
      month,
      year,
      categoryId: null,
    },
  });

  const submit = handleSubmit((data) => {
    setFormError(null);
    startTransition(async () => {
      const result: BudgetActionResult = await setBudget({
        amount: data.amount,
        month,
        year,
        categoryId: null,
      });
      if (!result.ok) {
        setFormError(result.error);
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages && messages.length > 0) {
              setError(field as keyof BudgetFormInput, { message: messages[0] });
            }
          }
        }
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  });

  const isOverBudget =
    overallBudget !== null && Number(overallSpent) > Number(overallBudget.amount);

  return (
    <section className="rounded-[12px] border border-[#e4ddcf] bg-[#fffdf8] p-5 dark:border-[#3a355a] dark:bg-[#272341]">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#1c1a17] dark:text-white">Overall budget</h2>
        {overallBudget && !editing && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className={buttonSecondary}>
              Edit
            </button>
            <DeleteBudgetButton id={overallBudget.id} />
          </div>
        )}
      </div>

      {overallBudget && !editing ? (
        <div className="mt-3">
          <BudgetBar
            spent={overallSpent}
            budget={overallBudget.amount}
            isOverBudget={isOverBudget}
            fillColor="#3b82f6"
            currency={currency}
          />
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
          <BudgetFormFields
            categories={[]}
            register={register}
            errors={errors}
            showCategory={false}
          />
          {formError && (
            <p className="w-full text-sm text-[#ef4444]" role="alert">
              {formError}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={buttonPrimary}>
              {pending ? "Saving..." : overallBudget ? "Save changes" : "Set overall budget"}
            </button>
            {overallBudget && (
              <button type="button" onClick={() => setEditing(false)} className={buttonSecondary}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

function DeleteBudgetButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#6f6a60] dark:text-[#9aa0b4]">Delete?</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await deleteBudget(id);
              if (!result.ok) {
                setError(result.error);
                setConfirming(false);
              } else {
                router.refresh();
              }
            });
          }}
          className="rounded-[8px] bg-[#ef4444] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Deleting..." : "Confirm"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={buttonSecondary}>
          Cancel
        </button>
        {error && (
          <p className="text-xs text-[#ef4444]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-[8px] border border-[#e4ddcf] px-3 py-1.5 text-sm font-medium text-[#ef4444] transition-colors hover:bg-[#ef4444]/10 dark:border-[#3a355a]"
    >
      Delete
    </button>
  );
}

function CategoryBudgetCard({
  budget,
  month,
  year,
  currency,
}: {
  budget: CategoryBudget;
  month: number;
  year: number;
  currency: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<BudgetFormInput, unknown, BudgetInput>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      amount: budget.amount,
      month,
      year,
      categoryId: budget.categoryId,
    },
  });

  const submit = handleSubmit((data) => {
    setFormError(null);
    startTransition(async () => {
      const result = await setBudget({
        amount: data.amount,
        month,
        year,
        categoryId: budget.categoryId,
      });
      if (!result.ok) {
        setFormError(result.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  });

  const isOverBudget = Number(budget.spent) > Number(budget.amount);

  return (
    <div className="rounded-[12px] border border-[#e4ddcf] bg-[#fffdf8] p-4 dark:border-[#3a355a] dark:bg-[#272341]">
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: budget.categoryColor }}
        >
          {budget.categoryName}
        </span>
        {!editing && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className={buttonSecondary}>
              Edit
            </button>
            <DeleteBudgetButton id={budget.id} />
          </div>
        )}
      </div>

      {editing ? (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
          <BudgetFormFields
            categories={[]}
            register={register}
            errors={errors}
            showCategory={false}
          />
          {formError && (
            <p className="w-full text-sm text-[#ef4444]" role="alert">
              {formError}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={buttonPrimary}>
              {pending ? "Saving..." : "Save changes"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className={buttonSecondary}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3">
          <BudgetBar
            spent={budget.spent}
            budget={budget.amount}
            isOverBudget={isOverBudget}
            fillColor={budget.categoryColor}
            currency={currency}
          />
        </div>
      )}
    </div>
  );
}

function AddCategoryBudgetForm({
  month,
  year,
  categories,
}: {
  month: number;
  year: number;
  categories: Category[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<BudgetFormInput, unknown, BudgetInput>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { amount: "", month, year, categoryId: "" },
  });

  if (categories.length === 0 && !showForm) {
    return null;
  }

  const submit = handleSubmit((data) => {
    setFormError(null);
    startTransition(async () => {
      const result = await setBudget({
        amount: data.amount,
        month,
        year,
        categoryId: data.categoryId || null,
      });
      if (!result.ok) {
        setFormError(result.error);
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages && messages.length > 0) {
              setError(field as keyof BudgetFormInput, { message: messages[0] });
            }
          }
        }
      } else {
        setShowForm(false);
        reset({ amount: "", month, year, categoryId: "" });
        router.refresh();
      }
    });
  });

  if (!showForm) {
    return (
      <button type="button" onClick={() => setShowForm(true)} className={buttonPrimary}>
        + Add category budget
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 rounded-[12px] border border-[#e4ddcf] bg-[#fffdf8] p-4 dark:border-[#3a355a] dark:bg-[#272341]"
    >
      <BudgetFormFields
        categories={categories}
        register={register}
        errors={errors}
        showCategory
      />
      {formError && (
        <p className="w-full text-sm text-[#ef4444]" role="alert">
          {formError}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "Saving..." : "Add budget"}
        </button>
        <button type="button" onClick={() => setShowForm(false)} className={buttonSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function BudgetsClient({
  month,
  year,
  currency,
  overallBudget,
  overallSpent,
  categoryBudgets,
  availableCategories,
}: {
  month: number;
  year: number;
  currency: string;
  overallBudget: OverallBudget;
  overallSpent: string;
  categoryBudgets: CategoryBudget[];
  availableCategories: Category[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <MonthYearPicker month={month} year={year} />

      <OverallBudgetSection
        month={month}
        year={year}
        currency={currency}
        overallBudget={overallBudget}
        overallSpent={overallSpent}
      />

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-[#1c1a17] dark:text-white">
          Category budgets
        </h2>

        {categoryBudgets.length === 0 ? (
          <p className="text-sm text-[#6f6a60] dark:text-[#9aa0b4]">
            No per-category budgets set for this month yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {categoryBudgets.map((b) => (
              <CategoryBudgetCard key={b.id} budget={b} month={month} year={year} currency={currency} />
            ))}
          </div>
        )}

        <div>
          <AddCategoryBudgetForm month={month} year={year} categories={availableCategories} />
        </div>
      </div>
    </div>
  );
}
