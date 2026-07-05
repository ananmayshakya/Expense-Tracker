# Tally — Personal Expense Tracker

Tally is a full-stack expense tracker demonstrating end-to-end ownership: real
authentication, role-based access control enforced server-side, database
persistence, and full CRUD across expenses, categories, budgets, and
recurring expenses — plus dashboards, charts, CSV export, and an admin panel.

## Features

- **Auth & RBAC** — credentials-based login (hashed passwords), JWT sessions,
  USER vs ADMIN roles enforced on every server action/route (never trusted
  from the client).
- **Expenses** — full CRUD with server-side filtering (category, date range,
  text search) and sorting.
- **Custom categories** — color-coded, per-user, with sensible defaults
  seeded on registration.
- **Dashboard** — spend summary cards and Recharts visualizations (category
  breakdown + 6-month trend).
- **Budgets** — overall and per-category monthly budgets with progress bars
  and an over-budget warning.
- **Recurring expenses** — auto-materializes due expenses on load (with
  multi-period catch-up) plus a manual "Run now" action.
- **CSV export** — download your filtered expense list; admins can export
  any user's data.
- **Admin panel** — view all users and change roles, with a guard against
  ever removing the last admin, and hardened against stale-session privilege
  (see Security notes below).
- **Settings** — currency picker (formats every amount app-wide) and a
  light/dark/system theme toggle that persists across devices.

## Tech stack

- **Next.js 16** (App Router) + React 19.2 — Turbopack by default. Note: Next
  16 renamed `middleware.ts` to `proxy.ts` (see `src/proxy.ts`).
- **TypeScript** (strict mode)
- **Tailwind CSS v4**
- **PostgreSQL 17** (via Docker)
- **Prisma 7** — uses the new `prisma-client` generator with the WASM query
  compiler, which requires an explicit driver adapter (`@prisma/adapter-pg`
  + `pg`). The generated client is **not** committed (git-ignored) and gets
  (re)built by a `postinstall` hook (`prisma generate`) — this runs
  automatically as part of `npm install`.
- **Auth.js v5** (NextAuth beta) — Credentials provider, JWT session
  strategy (no OAuth/adapter tables needed).
- **bcryptjs** for password hashing.
- **Recharts** for charts.
- **next-themes** for light/dark/system theming.
- **Zod** + **react-hook-form** for validation.
- **Vitest** for unit tests.

## Prerequisites

- **Node.js** (v20.9+; this project was built on v24)
- **Docker Desktop** (for the local Postgres container)

## Fresh clone setup

```bash
# 1. Copy the env template and fill in secrets
cp .env.example .env
```

Generate a secret for `AUTH_SECRET` and paste it into `.env`:

```bash
npx auth secret
```

`.env` should end up looking like:

```
DATABASE_URL="postgresql://expense:expense@localhost:5432/expense_tracker?schema=public"
AUTH_SECRET="<your generated secret>"
AUTH_TRUST_HOST="true"
```

```bash
# 2. Install dependencies (this also runs `prisma generate` via postinstall)
npm install

# 3. Start Postgres in Docker
npm run db:up

# 4. Run migrations
npm run db:migrate

# 5. Seed demo data
npm run db:seed

# 6. Start the dev server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) — you'll land on
`/login` if signed out, or `/dashboard` if already signed in.

### Demo accounts (seeded)

| Role  | Email             | Password      |
|-------|-------------------|---------------|
| Admin | `admin@demo.com`  | `Password123!` |
| User  | `user@demo.com`   | `Password123!` |

Both accounts come with default categories; the demo user also has ~20
sample expenses, a monthly budget, and one active recurring expense so the
dashboard charts have real data to show.

## Other useful scripts

```bash
npm run build      # production build
npm run start      # run the production build
npm run db:studio  # Prisma Studio (browse the DB)
npm test           # vitest (watch mode)
npm run test:run   # vitest run (single pass, used in CI-style checks)
npm run lint       # eslint
```

## Security notes

- Every server action/route that reads or mutates a user-owned resource
  derives identity from the verified session (never from client-supplied
  `userId`) and checks ownership or admin role server-side.
- Because sessions use the JWT strategy, a token caches `role` at issuance.
  To bound the risk of a demoted or deleted admin retaining elevated access
  on an already-issued token, the admin surface (`requireAdmin()` and the
  `setUserRole` action) re-verifies the caller's current role directly
  against the database rather than trusting the token alone, and the
  session `maxAge` is set to 24 hours (instead of the 30-day default) as
  defense-in-depth.
- Role changes are guarded against ever reducing the admin count to zero,
  enforced atomically inside a Serializable transaction.
