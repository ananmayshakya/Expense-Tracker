"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import {
  createRecurring,
  deleteRecurring,
  runRecurringNow,
  setRecurringActive,
  updateRecurring,
  type RecurringActionResult,
} from "@/actions/recurring";
import { formatMoney } from "@/lib/currency";
import {
  recurringSchema,
  type RecurringFormInput,
  type RecurringInput,
} from "@/lib/validations";

type Category = { id: string; name: string; color: string };

type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

type Recurring = {
  id: string;
  amount: string;
  description: string;
  frequency: Frequency;
  nextRunDate: string; // ISO string
  active: boolean;
  categoryId: string | null;
  category: Category | null;
};

const inputClasses =
  "rounded-[8px] border border-[#e4ddcf] bg-[#fffdf8] px-3 py-2 text-sm text-[#1c1a17] outline-none focus:border-[#3b82f6] dark:border-[#3a355a] dark:bg-[#272341] dark:text-white";

const buttonPrimary =
  "rounded-[8px] bg-[#1c1a17] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-[#1c1a17]";

const buttonSecondary =
  "rounded-[8px] border border-[#e4ddcf] px-3 py-1.5 text-sm font-medium text-[#1c1a17] transition-colors hover:bg-black/5 dark:border-[#3a355a] dark:text-white dark:hover:bg-white/5";

const FREQUENCY_LABELS: Record<Frequency, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

// Fixed locale for date labels — same rationale as the expense date-label
// fix in ExpensesClient.tsx: server and browser default locales can
// differ, causing a hydration mismatch. A fixed locale keeps SSR and
// client output identical.
function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toFormValues(recurring?: Recurring): RecurringFormInput {
  if (!recurring) {
    return {
      amount: "",
      description: "",
      frequency: "MONTHLY",
      nextRunDate: new Date().toISOString().slice(0, 10),
      active: true,
      categoryId: null,
    };
  }
  return {
    amount: recurring.amount,
    description: recurring.description,
    frequency: recurring.frequency,
    nextRunDate: recurring.nextRunDate.slice(0, 10),
    active: recurring.active,
    categoryId: recurring.categoryId,
  };
}

function RecurringForm({
  categories,
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  categories: Category[];
  defaultValues: RecurringFormInput;
  onSubmit: (data: RecurringInput) => Promise<RecurringActionResult>;
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
  } = useForm<RecurringFormInput, unknown, RecurringInput>({
    resolver: zodResolver(recurringSchema),
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
              setError(field as keyof RecurringFormInput, { message: messages[0] });
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
        <label htmlFor="frequency" className="text-sm font-medium text-[#1c1a17] dark:text-white">
          Frequency
        </label>
        <select id="frequency" {...register("frequency")} className={`${inputClasses} w-32`}>
          {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => (
            <option key={f} value={f}>
              {FREQUENCY_LABELS[f]}
            </option>
          ))}
        </select>
        {errors.frequency && (
          <p className="text-xs text-[#ef4444]" role="alert">
            {errors.frequency.message as string}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="nextRunDate" className="text-sm font-medium text-[#1c1a17] dark:text-white">
          Next run date
        </label>
        <input
          id="nextRunDate"
          type="date"
          {...register("nextRunDate")}
          className={`${inputClasses} w-40`}
        />
        {errors.nextRunDate && (
          <p className="text-xs text-[#ef4444]" role="alert">
            {errors.nextRunDate.message as string}
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

      <div className="flex items-center gap-2 pb-2">
        <input
          id="active"
          type="checkbox"
          {...register("active")}
          className="h-4 w-4 rounded border-[#e4ddcf] dark:border-[#3a355a]"
        />
        <label htmlFor="active" className="text-sm font-medium text-[#1c1a17] dark:text-white">
          Active
        </label>
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

function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setRecurringActive(id, !active);
      if (!result.ok) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={active ? "Deactivate" : "Activate"}
        disabled={pending}
        onClick={toggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          active ? "bg-[#22c55e]" : "bg-black/15 dark:bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            active ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
      {error && (
        <p className="text-xs text-[#ef4444]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
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
              const result = await deleteRecurring(id);
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

function RecurringRow({
  recurring,
  categories,
  currency,
}: {
  recurring: Recurring;
  categories: Category[];
  currency: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr>
        <td colSpan={6} className="p-4">
          <RecurringForm
            categories={categories}
            defaultValues={toFormValues(recurring)}
            submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            onSubmit={async (data) => {
              const result = await updateRecurring(recurring.id, data);
              if (result.ok) setEditing(false);
              return result;
            }}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-[#e4ddcf] last:border-0 dark:border-[#3a355a]">
      <td className="px-4 py-3 text-sm text-[#1c1a17] dark:text-white">
        {recurring.description}
      </td>
      <td className="px-4 py-3">
        {recurring.category ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: recurring.category.color }}
          >
            {recurring.category.name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-[#6f6a60] dark:bg-white/10 dark:text-[#9aa0b4]">
            Uncategorized
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-[#1c1a17] dark:text-white">
        {FREQUENCY_LABELS[recurring.frequency]}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-[#1c1a17] dark:text-white">
        {formatDateLabel(recurring.nextRunDate)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-[#1c1a17] dark:text-white">
        {formatMoney(recurring.amount, currency)}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <ActiveToggle id={recurring.id} active={recurring.active} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setEditing(true)} className={buttonSecondary}>
            Edit
          </button>
          <DeleteButton id={recurring.id} />
        </div>
      </td>
    </tr>
  );
}

function RunNowButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await runRecurringNow();
      if (!result.ok) {
        setError(result.error);
      } else {
        setMessage(
          result.expensesCreated === 0
            ? "Nothing was due — you're all caught up."
            : `Created ${result.expensesCreated} expense${
                result.expensesCreated === 1 ? "" : "s"
              } from ${result.rowsProcessed} recurring item${
                result.rowsProcessed === 1 ? "" : "s"
              }.`
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={run} disabled={pending} className={buttonPrimary}>
        {pending ? "Running..." : "Run now"}
      </button>
      {message && (
        <p className="text-xs text-[#6f6a60] dark:text-[#9aa0b4]" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="text-xs text-[#ef4444]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function RecurringClient({
  initialRecurring,
  categories,
  currency,
}: {
  initialRecurring: Recurring[];
  categories: Category[];
  currency: string;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#e4ddcf] bg-[#fffdf8] p-4 dark:border-[#3a355a] dark:bg-[#272341]">
        <p className="text-sm text-[#6f6a60] dark:text-[#9aa0b4]">
          Manually materialize any due recurring items right now, instead of waiting for the
          next dashboard load.
        </p>
        <RunNowButton />
      </div>

      <div className="rounded-[12px] border border-[#e4ddcf] bg-[#fffdf8] p-4 dark:border-[#3a355a] dark:bg-[#272341]">
        {showCreate ? (
          <RecurringForm
            categories={categories}
            defaultValues={toFormValues()}
            submitLabel="Add recurring expense"
            onCancel={() => setShowCreate(false)}
            onSubmit={async (data) => {
              const result = await createRecurring(data);
              if (result.ok) setShowCreate(false);
              return result;
            }}
          />
        ) : (
          <button type="button" onClick={() => setShowCreate(true)} className={buttonPrimary}>
            + Add recurring expense
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-[12px] border border-[#e4ddcf] bg-[#fffdf8] dark:border-[#3a355a] dark:bg-[#272341]">
        {initialRecurring.length === 0 ? (
          <p className="p-4 text-sm text-[#6f6a60] dark:text-[#9aa0b4]">
            No recurring expenses yet.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#e4ddcf] text-left text-xs font-medium uppercase tracking-wide text-[#6f6a60] dark:border-[#3a355a] dark:text-[#9aa0b4]">
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3">Next run</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialRecurring.map((row) => (
                <RecurringRow
                  key={row.id}
                  recurring={row}
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
