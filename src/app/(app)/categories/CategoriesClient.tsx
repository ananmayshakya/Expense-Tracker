"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import {
  createCategory,
  deleteCategory,
  updateCategory,
  type CategoryActionResult,
} from "@/actions/categories";
import { categorySchema, type CategoryInput } from "@/lib/validations";

type Category = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
};

// Preset swatches per §16 category chart colors + a few extras, plus the
// schema default. Users can still type any hex value.
const PRESET_COLORS = [
  "#22c55e",
  "#f59e0b",
  "#3b82f6",
  "#a855f7",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#6b7280",
];

function CategoryForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  defaultValues: CategoryInput;
  onSubmit: (data: CategoryInput) => Promise<CategoryActionResult>;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  // Unique per form instance (react's useId) so the create form and an
  // open edit-row form never collide on `id` — previously both used the
  // hardcoded ids "name"/"color", which is invalid HTML (duplicate IDs)
  // and breaks `<label htmlFor>` association when both forms are mounted
  // at once (Phase 3 a11y carryover, fixed Phase 11).
  const instanceId = useId();
  const nameId = `${instanceId}-name`;
  const colorId = `${instanceId}-color`;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues,
  });

  const color = watch("color");

  const submit = handleSubmit((data) => {
    setFormError(null);
    startTransition(async () => {
      const result = await onSubmit(data);
      if (!result.ok) {
        setFormError(result.error);
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages && messages.length > 0) {
              setError(field as keyof CategoryInput, { message: messages[0] });
            }
          }
        }
      } else {
        // revalidatePath() in the server action refreshes server-side
        // cache; router.refresh() re-fetches this route's RSC payload so
        // the newly loaded `initialCategories` prop reflects the mutation.
        router.refresh();
      }
    });
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor={nameId}
          className="text-sm font-medium text-[#1c1a17] dark:text-white"
        >
          Name
        </label>
        <input
          id={nameId}
          type="text"
          maxLength={40}
          {...register("name")}
          className="rounded-[8px] border border-[#e4ddcf] bg-[#fffdf8] px-3 py-2 text-sm text-[#1c1a17] outline-none focus:border-[#3b82f6] dark:border-[#3a355a] dark:bg-[#272341] dark:text-white"
        />
        {errors.name && (
          <p className="text-xs text-[#ef4444]" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[#1c1a17] dark:text-white">Color</span>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={`Use color ${preset}`}
              onClick={() => setValue("color", preset, { shouldValidate: true })}
              className="h-7 w-7 rounded-full ring-offset-2 ring-offset-[#fffdf8] transition-shadow dark:ring-offset-[#272341]"
              style={{
                backgroundColor: preset,
                boxShadow: color === preset ? "0 0 0 2px #1c1a17" : undefined,
              }}
            />
          ))}
          <input
            id={colorId}
            type="text"
            aria-label="Custom hex color"
            {...register("color")}
            className="w-28 rounded-[8px] border border-[#e4ddcf] bg-[#fffdf8] px-3 py-2 text-sm text-[#1c1a17] outline-none focus:border-[#3b82f6] dark:border-[#3a355a] dark:bg-[#272341] dark:text-white"
          />
          <span
            className="h-7 w-7 rounded-full border border-black/10"
            style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined }}
          />
        </div>
        {errors.color && (
          <p className="text-xs text-[#ef4444]" role="alert">
            {errors.color.message}
          </p>
        )}
      </div>

      {formError && (
        <p className="text-sm text-[#ef4444]" role="alert">
          {formError}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[8px] bg-[#1c1a17] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-[#1c1a17]"
        >
          {pending ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[8px] border border-[#e4ddcf] px-4 py-2 text-sm font-medium text-[#1c1a17] transition-colors hover:bg-black/5 dark:border-[#3a355a] dark:text-white dark:hover:bg-white/5"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (editing) {
    return (
      <li className="rounded-[12px] border border-[#e4ddcf] bg-[#fffdf8] p-4 dark:border-[#3a355a] dark:bg-[#272341]">
        <CategoryForm
          defaultValues={{ name: category.name, color: category.color }}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (data) => {
            const result = await updateCategory(category.id, data);
            if (result.ok) setEditing(false);
            return result;
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded-[12px] border border-[#e4ddcf] bg-[#fffdf8] p-4 dark:border-[#3a355a] dark:bg-[#272341]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="h-6 w-6 shrink-0 rounded-full"
            style={{ backgroundColor: category.color }}
            aria-hidden
          />
          <span className="font-medium text-[#1c1a17] dark:text-white">{category.name}</span>
          {category.isDefault && (
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-[#6f6a60] dark:bg-white/10 dark:text-[#9aa0b4]">
              Default
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {confirmingDelete ? (
            <>
              <span className="text-sm text-[#6f6a60] dark:text-[#9aa0b4]">Delete?</span>
              <button
                type="button"
                disabled={deletePending}
                onClick={() => {
                  setDeleteError(null);
                  startDeleteTransition(async () => {
                    const result = await deleteCategory(category.id);
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
                className="rounded-[8px] border border-[#e4ddcf] px-3 py-1.5 text-sm font-medium text-[#1c1a17] transition-colors hover:bg-black/5 dark:border-[#3a355a] dark:text-white dark:hover:bg-white/5"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-[8px] border border-[#e4ddcf] px-3 py-1.5 text-sm font-medium text-[#1c1a17] transition-colors hover:bg-black/5 dark:border-[#3a355a] dark:text-white dark:hover:bg-white/5"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="rounded-[8px] border border-[#e4ddcf] px-3 py-1.5 text-sm font-medium text-[#ef4444] transition-colors hover:bg-[#ef4444]/10 dark:border-[#3a355a]"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
      {deleteError && (
        <p className="text-xs text-[#ef4444]" role="alert">
          {deleteError}
        </p>
      )}
    </li>
  );
}

export default function CategoriesClient({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[12px] border border-[#e4ddcf] bg-[#fffdf8] p-4 dark:border-[#3a355a] dark:bg-[#272341]">
        {showCreate ? (
          <CategoryForm
            defaultValues={{ name: "", color: "#6b7280" }}
            submitLabel="Create category"
            onCancel={() => setShowCreate(false)}
            onSubmit={async (data) => {
              const result = await createCategory(data);
              if (result.ok) setShowCreate(false);
              return result;
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-[8px] bg-[#1c1a17] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 dark:bg-white dark:text-[#1c1a17]"
          >
            + New category
          </button>
        )}
      </div>

      {initialCategories.length === 0 ? (
        <p className="text-sm text-[#6f6a60] dark:text-[#9aa0b4]">
          You don&apos;t have any categories yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {initialCategories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </ul>
      )}
    </div>
  );
}
