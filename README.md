# Tally — Personal Expense Tracker

Tally is a full-stack expense tracker demonstrating end-to-end ownership: real
authentication, role-based access control enforced server-side, database
persistence, and full CRUD across expenses, categories, budgets, and
recurring expenses — plus dashboards, charts, CSV export, and an admin panel.

**🔗 Live demo:** [TODO: add deployed URL] — sign in with a [demo account](#demo-accounts-seeded)
below. This is a public demo: anyone can sign in with the demo accounts (or
register their own), so seeded data may be edited or deleted by other
visitors from time to time.

## Screenshots

> Screenshots live in `docs/screenshots/`. Run the app (`npm run dev`, then
> sign in with a demo account below) and drop your own captures in using the
> filenames referenced here to populate this section.

| Dashboard | Transactions |
| --- | --- |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Transactions](docs/screenshots/transactions.png) |

| Budgets | Dark mode |
| --- | --- |
| ![Budgets](docs/screenshots/budgets.png) | ![Dark mode](docs/screenshots/dark-mode.png) |

## Features

### Authentication & accounts
- **Registration** — email/password sign-up with server-side validation.
  Passwords are hashed with bcrypt (cost 12) and never returned to the client.
- **Login / logout** via Auth.js v5 (Credentials provider, JWT session
  strategy).
- **Starter data** — new users are automatically seeded a set of default
  categories so the app is usable immediately.
- **Profile management** — change your display name and change your password
  (the current password is required to set a new one).

### Role-based access control (RBAC)
- **Two roles — USER and ADMIN** — enforced on the **server** for every action
  and route; roles/identity are never trusted from the client.
- **Ownership enforcement** — every read or mutation of user-owned data checks
  that the caller is the owner (or an admin) server-side.
- **Route protection** — unauthenticated visitors are redirected to `/login`;
  signed-in users hitting the auth pages are sent to the dashboard; the landing
  page redirects based on auth state.

### Expenses (core CRUD)
- **Create / edit / delete** expenses (amount, description, date, category).
- **Exact-decimal money** — amounts are stored and computed as fixed-point
  decimals (no floating-point drift) and formatted in your chosen currency.
- **Server-side filtering** — filter by multiple categories, a date range
  (from/to), and free-text description search.
- **Server-side sorting** — by date or amount, ascending or descending.
- **Shareable views** — filters and sort live in the URL, so a filtered view
  is bookmarkable and links straight to a matching CSV export.

### Categories
- **Full CRUD** of custom, per-user categories, each with a **color picker**;
  colors are shown as chips on expenses, charts, and budgets.
- **Default categories** seeded on registration (Food, Transport, Bills,
  Entertainment, Shopping, Health, Other).
- **Safe deletion** — deleting a category re-labels its expenses as
  "Uncategorized" (history is preserved, not destroyed).
- **Duplicate-name protection** per user, surfaced as a friendly inline error.

### Dashboard
- **Gradient summary cards** — total spent this month, number of expenses this
  month, and a month-over-month change indicator.
- **Budget status** — the current month's overall budget with a
  spent-vs-budget progress bar (or a clear "no budget set" state).
- **Spend-by-category donut chart** for the current month, colored per
  category (with an "Uncategorized" slice).
- **6-month spending trend** bar chart.
- **Graceful empty states** everywhere there's no data yet.

### Budgets
- **Overall and/or per-category** monthly budgets.
- **Progress bars** showing spent vs budget; the fill uses the category color
  and **turns red when over budget**.
- **Month/year selector** to review any period.
- **Guards** against duplicate overall budgets for the same month.

### Recurring expenses
- **Define recurring items** — amount, description, category, frequency, next
  run date, and an active toggle.
- **Frequencies** — daily, weekly, monthly, yearly, with correct month-length
  and leap-year handling.
- **Auto-materialization** — due items turn into real expenses on dashboard
  load, with **multi-period catch-up** for anything overdue (idempotent, so it
  never double-charges).
- **Manual "Run now"** button, plus an **active/inactive toggle** to pause a
  series without deleting it.

### CSV export
- **Download** your expenses as a CSV that honors the **currently applied
  filters** (so the file matches what's on screen).
- Amounts formatted; dated filename (`expenses-YYYYMMDD.csv`).
- **Injection-safe** — hardened against CSV/formula injection.
- **Admins** can export any user's expenses (admin-gated).

### Admin panel
- **User table** — email, name, role, number of expenses, and join date.
- **Role management** — promote/demote users between USER and ADMIN.
- **Last-admin guard** — the system will never let the final admin be
  demoted/removed (enforced atomically in a serializable transaction).
- **Stale-session hardening** — admin status is re-checked against the database,
  so a demoted admin can't keep acting on a still-valid token.
- The **Admin** nav entry only appears for admins.

### Settings & personalization
- **Currency picker** (USD, EUR, GBP, JPY, INR, CAD, AUD, CNY, and more) —
  changing it **reformats every amount app-wide instantly**, no re-login, with
  correct symbols and decimal places per currency (e.g. JPY has no decimals).
- **Theme toggle** — light / dark / system, **persisted to your account** so it
  follows you across devices (and remembered locally between reloads).
- Profile name and password management (see Accounts).

### Design & UX
- **"Tally" design system** — a fixed **dark sidebar that stays dark in both
  light and dark mode**, gradient stat cards, rounded panels, and colored
  category chips.
- **Responsive** — the sidebar collapses to an off-canvas drawer (hamburger +
  overlay) on mobile; desktop is unchanged.
- **Accessible** switches/toggles with proper roles and labels, and inline
  form validation errors.

### Testing
- **Vitest** unit suite covering the permission checks, currency formatting,
  decimal money math (no drift), and the recurrence date logic (including
  leap-year and multi-period catch-up).

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

## Deploy

Tally deploys for free on **Vercel** (Hobby plan) with a hosted **Neon**
Postgres database (Neon's free tier + Vercel's serverless model pair well —
Neon pools connections, which matters when every request is a short-lived
serverless function).

### 1. Create a Neon Postgres database

Sign up at [neon.tech](https://neon.tech) (free) and create a project. Neon
gives you two connection strings for it — copy both:

- **Pooled** (hostname contains `-pooler`) — used by the deployed app.
- **Direct** (no pooler) — used only for one-off admin tasks (migrations,
  seeding), since pooled/transaction-mode connections aren't reliable for DDL.

### 2. Import the repo into Vercel

[New Project → Import Git Repository](https://vercel.com/new) and select this
repo. Vercel auto-detects Next.js; no build config changes are needed.

### 3. Set environment variables (in the Vercel project settings)

| Variable          | Value                                                              |
|--------------------|--------------------------------------------------------------------|
| `DATABASE_URL`     | Neon's **pooled** connection string, with `?sslmode=require` (add `&pgbouncer=true&connection_limit=1` too if Prisma reports prepared-statement errors through the pooler) |
| `AUTH_SECRET`      | A fresh secret — generate with `npx auth secret` (don't reuse a local dev secret) |
| `AUTH_TRUST_HOST`  | `true`                                                              |

(`AUTH_URL` doesn't need to be set — Auth.js infers it on Vercel from request
headers. Only add it if callback URLs misbehave.)

### 4. Initialize the database (one-time, run from your machine against Neon)

Point `DATABASE_URL` at Neon's **direct** (non-pooled) string for these two
commands only:

```bash
DATABASE_URL="<neon-direct-connection-string>" npx prisma migrate deploy
DATABASE_URL="<neon-direct-connection-string>" npm run db:seed
```

`npm install` already wires a `postinstall` hook that runs `prisma generate`,
so Vercel's build handles that automatically — no extra build config needed.

### 5. Deploy and verify

Vercel deploys on import (and on every push to `main` afterward). Once live,
sign in with both [demo accounts](#demo-accounts-seeded) and check the
dashboard, charts, filters, CSV export, and dark-mode toggle.

### Resetting the demo data

Because the demo logins are public, visitors can edit or delete the seeded
data over time. The seed script is safe to re-run whenever you want to
restore it — it's scoped strictly to the two demo accounts (upserts the
users, wipes and recreates only their expenses/categories/budgets/recurring
rows) and never touches any other user's data:

```bash
DATABASE_URL="<neon-direct-connection-string>" npm run db:seed
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
