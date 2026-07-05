import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { auth } from "@/auth";
import Providers from "@/components/Providers";
import { THEME_VALUES, type ThemeValue } from "@/lib/validations";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tally",
  description: "A full-stack personal expense tracker.",
};

function isThemeValue(value: unknown): value is ThemeValue {
  return typeof value === "string" && (THEME_VALUES as readonly string[]).includes(value);
}

/**
 * Root layout (PLAN.md §8/§16). `suppressHydrationWarning` on <html> is
 * required by next-themes (see node_modules/next-themes/README.md "With
 * app/") because the injected pre-hydration script sets the `class`
 * attribute on <html> before React hydrates, which would otherwise report a
 * false-positive hydration mismatch. It only suppresses the warning one
 * level deep (the <html> element itself), so it doesn't hide real
 * mismatches elsewhere in the tree.
 *
 * Phase 8 (§16 "survives login on other devices"): this Server Component
 * reads the session directly via `auth()` and passes `session.user.theme`
 * to `Providers` as next-themes' `defaultTheme`, so a FRESH device/browser
 * (empty localStorage) picks up the user's DB-stored preference instead of
 * always defaulting to "system". No session (e.g. on /login, /register) ->
 * falls back to "system". Any stored theme value must be one of
 * light|dark|system — anything else (shouldn't happen given updateTheme's
 * Zod validation, but defense-in-depth) also falls back to "system".
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const defaultTheme: ThemeValue = isThemeValue(session?.user?.theme)
    ? session.user.theme
    : "system";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers defaultTheme={defaultTheme}>{children}</Providers>
      </body>
    </html>
  );
}
