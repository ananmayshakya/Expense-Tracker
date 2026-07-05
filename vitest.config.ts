import path from "node:path";
import "dotenv/config";
import { defineConfig } from "vitest/config";

/**
 * Vitest 4 config (PLAN.md §11, Phase 11 Part A).
 *
 * `vite-tsconfig-paths` is NOT an installed dependency (see AGENTS.md task
 * scope) — resolve the `@/*` -> `src/*` alias manually instead, matching
 * tsconfig.json's `paths`.
 *
 * Environment: `node` is sufficient — every test in the §11 focused list
 * targets pure/DB-adjacent lib modules (permissions, currency, money,
 * recurrence), not rendered React components. `Prisma.Decimal` is a plain
 * JS class (decimal.js-based) with no DOM dependency, so it works fine
 * under `node`. Switch a given test file to jsdom individually (via a
 * `// @vitest-environment jsdom` docblock) if a future test renders a
 * component — no need to pay the jsdom cost globally.
 *
 * `import "dotenv/config"` loads `.env` into the Vitest config process (and
 * therefore into every test worker) — standalone tools don't auto-load
 * `.env` the way `next dev` does (AGENTS.md §2.1 driver-adapter note).
 * `@/lib/prisma` fail-fasts if `DATABASE_URL` is unset, and `permissions.ts`
 * (tested here) transitively imports `@/auth` -> `@/lib/prisma`, so this is
 * required just to import the module under test, even though no test in
 * this suite actually hits the database.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    server: {
      deps: {
        // `next-auth` imports bare `next/server` (no extension). Next.js
        // itself doesn't declare a package.json `exports` map, so this
        // resolves fine under webpack/Turbopack (and Node's CJS
        // require.resolve, which infers `.js`), but Vitest's default SSR
        // module resolution is stricter about extensionless ESM specifiers
        // for externalized deps. Inlining next-auth makes Vite's bundler
        // resolver (which DOES infer the extension) handle it instead of
        // deferring to Node's native ESM loader.
        inline: [/next-auth/],
      },
    },
  },
});
