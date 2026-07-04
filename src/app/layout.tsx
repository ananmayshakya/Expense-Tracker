import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Providers from "@/components/Providers";

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

/**
 * Root layout (PLAN.md §8/§16). `suppressHydrationWarning` on <html> is
 * required by next-themes (see node_modules/next-themes/README.md "With
 * app/") because the injected pre-hydration script sets the `class`
 * attribute on <html> before React hydrates, which would otherwise report a
 * false-positive hydration mismatch. It only suppresses the warning one
 * level deep (the <html> element itself), so it doesn't hide real
 * mismatches elsewhere in the tree.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
