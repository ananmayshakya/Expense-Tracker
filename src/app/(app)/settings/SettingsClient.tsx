"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useTheme } from "next-themes";

import {
  updateCurrency,
  updatePassword,
  updateProfile,
  updateTheme,
} from "@/actions/settings";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import {
  THEME_VALUES,
  updateCurrencySchema,
  updatePasswordSchema,
  updateProfileSchema,
  type ThemeValue,
  type UpdateCurrencyInput,
  type UpdatePasswordInput,
  type UpdateProfileInput,
} from "@/lib/validations";

const inputClasses =
  "rounded-[8px] border border-[#e4ddcf] bg-[#fffdf8] px-3 py-2 text-sm text-[#1c1a17] outline-none focus:border-[#3b82f6] dark:border-[#3a355a] dark:bg-[#272341] dark:text-white";

const buttonPrimary =
  "rounded-[8px] bg-[#1c1a17] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-[#1c1a17]";

const panelClasses =
  "flex flex-col gap-4 rounded-[12px] border border-[#e4ddcf] bg-[#fffdf8] p-5 dark:border-[#3a355a] dark:bg-[#272341]";

const THEME_LABELS: Record<ThemeValue, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-[#ef4444]" role="alert">
      {message}
    </p>
  );
}

function SuccessNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="text-xs text-[#22c55e]" role="status">
      {message}
    </p>
  );
}

/**
 * Profile section — name only. Email is rendered read-only (display-only
 * this phase per the Phase 8 brief; no email-change endpoint exists).
 */
function ProfileSection({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const { update } = useSession();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name },
  });

  const submit = handleSubmit((data) => {
    setFormError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await updateProfile(data);
      if (!result.ok) {
        setFormError(result.error);
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages && messages.length > 0) {
              setError(field as keyof UpdateProfileInput, { message: messages[0] });
            }
          }
        }
        return;
      }
      // Refresh the JWT/session with the new name (allowlisted in the jwt
      // callback — see src/auth.config.ts) so the shell greeting updates
      // without a re-login, then re-render Server Components.
      await update({ name: data.name && data.name.length > 0 ? data.name : null });
      router.refresh();
      setSuccess("Profile updated.");
    });
  });

  return (
    <form onSubmit={submit} className={panelClasses}>
      <h2 className="text-base font-semibold text-[#1c1a17] dark:text-white">Profile</h2>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-[#1c1a17] dark:text-white">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          disabled
          readOnly
          className={`${inputClasses} cursor-not-allowed opacity-60`}
        />
        <p className="text-xs text-[#6f6a60] dark:text-[#9aa0b4]">
          Email cannot be changed here.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-[#1c1a17] dark:text-white">
          Name
        </label>
        <input
          id="name"
          type="text"
          maxLength={100}
          {...register("name")}
          className={inputClasses}
        />
        <FieldError message={errors.name?.message} />
      </div>

      {formError && <FieldError message={formError} />}
      <SuccessNote message={success} />

      <div>
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  );
}

/**
 * Password section — current + new + confirm. Confirm is a client-only
 * check (not sent to the server); the server independently verifies
 * `currentPassword` via bcrypt.compare and validates `newPassword` with the
 * shared `passwordSchema`.
 */
function PasswordSection() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors },
  } = useForm<UpdatePasswordInput & { confirmPassword: string }>({
    resolver: zodResolver(
      updatePasswordSchema.extend({
        confirmPassword: updatePasswordSchema.shape.newPassword,
      })
    ),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const newPassword = watch("newPassword");

  const submit = handleSubmit((data) => {
    setFormError(null);
    setSuccess(null);

    if (data.newPassword !== data.confirmPassword) {
      setError("confirmPassword", { message: "Passwords do not match." });
      return;
    }

    startTransition(async () => {
      const result = await updatePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      if (!result.ok) {
        setFormError(result.error);
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages && messages.length > 0) {
              setError(field as keyof UpdatePasswordInput, { message: messages[0] });
            }
          }
        }
        return;
      }
      reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccess("Password changed.");
    });
  });

  return (
    <form onSubmit={submit} className={panelClasses}>
      <h2 className="text-base font-semibold text-[#1c1a17] dark:text-white">Password</h2>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="currentPassword"
          className="text-sm font-medium text-[#1c1a17] dark:text-white"
        >
          Current password
        </label>
        <input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          {...register("currentPassword")}
          className={inputClasses}
        />
        <FieldError message={errors.currentPassword?.message} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="newPassword" className="text-sm font-medium text-[#1c1a17] dark:text-white">
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          {...register("newPassword")}
          className={inputClasses}
        />
        <FieldError message={errors.newPassword?.message} />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="confirmPassword"
          className="text-sm font-medium text-[#1c1a17] dark:text-white"
        >
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
          className={inputClasses}
        />
        <FieldError message={errors.confirmPassword?.message} />
        {newPassword && newPassword.length > 0 && (
          <p className="text-xs text-[#6f6a60] dark:text-[#9aa0b4]">
            At least 8 characters, with a letter and a number.
          </p>
        )}
      </div>

      {formError && <FieldError message={formError} />}
      <SuccessNote message={success} />

      <div>
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "Saving..." : "Change password"}
        </button>
      </div>
    </form>
  );
}

/**
 * Currency section — a <select> of SUPPORTED_CURRENCIES. On success,
 * refreshes the JWT via update({ currency }) (allowlisted in the jwt
 * callback) and router.refresh() so every page reading session.user.currency
 * reformats amounts app-wide without a re-login.
 */
function CurrencySection({ currency }: { currency: string }) {
  const router = useRouter();
  const { update } = useSession();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateCurrencyInput>({
    resolver: zodResolver(updateCurrencySchema),
    defaultValues: { currency },
  });

  const submit = handleSubmit((data) => {
    setFormError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await updateCurrency(data);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      await update({ currency: data.currency });
      router.refresh();
      setSuccess("Currency updated.");
    });
  });

  return (
    <form onSubmit={submit} className={panelClasses}>
      <h2 className="text-base font-semibold text-[#1c1a17] dark:text-white">Currency</h2>

      <div className="flex flex-col gap-1">
        <label htmlFor="currency" className="text-sm font-medium text-[#1c1a17] dark:text-white">
          Display currency
        </label>
        <select id="currency" {...register("currency")} className={`${inputClasses} w-full`}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <FieldError message={errors.currency?.message as string | undefined} />
        <p className="text-xs text-[#6f6a60] dark:text-[#9aa0b4]">
          Amounts are formatted, not converted — the underlying stored values don&apos;t change.
        </p>
      </div>

      {formError && <FieldError message={formError} />}
      <SuccessNote message={success} />

      <div>
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "Saving..." : "Save currency"}
        </button>
      </div>
    </form>
  );
}

/**
 * Theme section — light/dark/system selector, coexisting with the header
 * ThemeToggle. Drives next-themes directly (setTheme) for the instant
 * visual change/localStorage, persists to User.theme via updateTheme, and
 * refreshes the JWT via update({ theme }) + router.refresh() — same 3-step
 * flow as ThemeToggle.tsx, but exposes "system" too (the pill only toggles
 * light/dark).
 */
function ThemeSection({ initialTheme }: { initialTheme: string }) {
  const router = useRouter();
  const { update } = useSession();
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Prefer the live next-themes value once mounted/hydrated; fall back to
  // the session-sourced initialTheme for the very first render so the
  // <select> isn't stuck on a hardcoded default before hydration.
  const currentTheme = (theme as ThemeValue | undefined) ?? (initialTheme as ThemeValue);

  function handleChange(next: ThemeValue) {
    setFormError(null);
    setSuccess(null);
    setTheme(next);
    startTransition(async () => {
      const result = await updateTheme({ theme: next });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      await update({ theme: next });
      router.refresh();
      setSuccess("Theme updated.");
    });
  }

  return (
    <div className={panelClasses}>
      <h2 className="text-base font-semibold text-[#1c1a17] dark:text-white">Theme</h2>

      <div className="flex flex-col gap-1">
        <label htmlFor="theme" className="text-sm font-medium text-[#1c1a17] dark:text-white">
          Appearance
        </label>
        <select
          id="theme"
          value={currentTheme}
          disabled={pending}
          onChange={(e) => handleChange(e.target.value as ThemeValue)}
          className={`${inputClasses} w-full disabled:opacity-60`}
        >
          {THEME_VALUES.map((value) => (
            <option key={value} value={value}>
              {THEME_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="text-xs text-[#6f6a60] dark:text-[#9aa0b4]">
          &quot;System&quot; follows your device&apos;s light/dark setting. You can also use the
          toggle in the header.
        </p>
      </div>

      {formError && <FieldError message={formError} />}
      <SuccessNote message={success} />
    </div>
  );
}

export default function SettingsClient({
  name,
  email,
  currency,
  theme,
}: {
  name: string;
  email: string;
  currency: string;
  theme: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ProfileSection name={name} email={email} />
      <PasswordSection />
      <CurrencySection currency={currency} />
      <ThemeSection initialTheme={theme} />
    </div>
  );
}
