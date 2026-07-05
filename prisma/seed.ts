import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

/**
 * Demo seed data (PLAN.md §12, Phase 11 Part A).
 *
 * Idempotent / re-runnable: users are `upsert`ed by their unique `email`;
 * every child row (categories/expenses/budgets/recurring) is deleted and
 * recreated, but ONLY for the two demo user ids resolved below — never a
 * blanket `deleteMany()` across the whole table. This guarantees repeated
 * `prisma db seed` runs never crash on unique constraints and never touch
 * any other (non-demo) user's data.
 *
 * Password hashing matches the register route: bcrypt cost 12.
 */

const DEMO_PASSWORD = "Password123!";

// Mirrors the DEFAULT_CATEGORIES seeded by src/app/api/register/route.ts
// on real registration, so demo accounts look like normal accounts.
const DEFAULT_CATEGORIES: Array<{ name: string; color: string }> = [
  { name: "Food", color: "#f59e0b" },
  { name: "Transport", color: "#3b82f6" },
  { name: "Bills", color: "#ef4444" },
  { name: "Entertainment", color: "#a855f7" },
  { name: "Shopping", color: "#ec4899" },
  { name: "Health", color: "#22c55e" },
  { name: "Other", color: "#6b7280" },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // --- Users (upsert by unique email; never destructive on the User row
  // itself, so re-running preserves createdAt / doesn't duplicate). ---
  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: { passwordHash, role: "ADMIN", name: "Demo Admin" },
    create: {
      email: "admin@demo.com",
      name: "Demo Admin",
      passwordHash,
      role: "ADMIN",
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "user@demo.com" },
    update: { passwordHash, role: "USER", name: "Demo User" },
    create: {
      email: "user@demo.com",
      name: "Demo User",
      passwordHash,
      role: "USER",
    },
  });

  const demoUserIds = [admin.id, user.id];

  // --- Wipe and recreate child rows, STRICTLY scoped to the two demo user
  // ids (never a blanket deleteMany) so other users' data is untouched. ---
  await prisma.expense.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.recurringExpense.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.budget.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.category.deleteMany({ where: { userId: { in: demoUserIds } } });

  // --- Default categories for EACH user. ---
  async function seedCategories(userId: string) {
    const created: Record<string, string> = {};
    for (const cat of DEFAULT_CATEGORIES) {
      const row = await prisma.category.create({
        data: { userId, name: cat.name, color: cat.color, isDefault: true },
      });
      created[cat.name] = row.id;
    }
    return created;
  }

  await seedCategories(admin.id);
  const userCategories = await seedCategories(user.id);

  // --- ~20 sample expenses for the USER, spread over the last 6 months so
  // dashboard charts (6-month trend + this-month category donut) look
  // real. Amounts are plain strings -> Prisma casts to Decimal(12,2). ---
  const now = new Date();
  function monthsAgo(n: number, day: number) {
    return new Date(now.getFullYear(), now.getMonth() - n, day);
  }

  type SeedExpense = { amount: string; description: string; date: Date; category: string };

  const sampleExpenses: SeedExpense[] = [
    // Current month
    { amount: "42.50", description: "Grocery run", date: monthsAgo(0, 2), category: "Food" },
    { amount: "18.00", description: "Bus pass top-up", date: monthsAgo(0, 3), category: "Transport" },
    { amount: "65.00", description: "Electricity bill", date: monthsAgo(0, 4), category: "Bills" },
    { amount: "12.99", description: "Movie night", date: monthsAgo(0, 5), category: "Entertainment" },
    { amount: "89.20", description: "New shoes", date: monthsAgo(0, 6), category: "Shopping" },
    { amount: "35.00", description: "Pharmacy", date: monthsAgo(0, 7), category: "Health" },
    // 1 month ago
    { amount: "51.30", description: "Weekly groceries", date: monthsAgo(1, 3), category: "Food" },
    { amount: "22.75", description: "Rideshare", date: monthsAgo(1, 8), category: "Transport" },
    { amount: "72.10", description: "Internet bill", date: monthsAgo(1, 10), category: "Bills" },
    { amount: "15.50", description: "Streaming subscription", date: monthsAgo(1, 12), category: "Entertainment" },
    { amount: "44.99", description: "Groceries", date: monthsAgo(1, 20), category: "Food" },
    // 2 months ago
    { amount: "60.00", description: "Gas fill-up", date: monthsAgo(2, 2), category: "Transport" },
    { amount: "150.00", description: "Concert tickets", date: monthsAgo(2, 9), category: "Entertainment" },
    { amount: "38.40", description: "Groceries", date: monthsAgo(2, 15), category: "Food" },
    { amount: "95.00", description: "Water bill", date: monthsAgo(2, 22), category: "Bills" },
    // 3 months ago
    { amount: "27.60", description: "Clothes", date: monthsAgo(3, 5), category: "Shopping" },
    { amount: "48.00", description: "Doctor visit copay", date: monthsAgo(3, 11), category: "Health" },
    { amount: "33.20", description: "Groceries", date: monthsAgo(3, 18), category: "Food" },
    // 4 months ago
    { amount: "110.00", description: "Phone bill", date: monthsAgo(4, 6), category: "Bills" },
    { amount: "20.00", description: "Taxi", date: monthsAgo(4, 14), category: "Transport" },
    // 5 months ago
    { amount: "58.75", description: "Groceries", date: monthsAgo(5, 8), category: "Food" },
    { amount: "40.00", description: "Gym membership", date: monthsAgo(5, 16), category: "Health" },
  ];

  await prisma.expense.createMany({
    data: sampleExpenses.map((e) => ({
      amount: e.amount,
      description: e.description,
      date: e.date,
      userId: user.id,
      categoryId: userCategories[e.category] ?? null,
    })),
  });

  // --- One overall budget + one category budget for the current month,
  // for the USER. ---
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  await prisma.budget.create({
    data: {
      userId: user.id,
      categoryId: null,
      month: currentMonth,
      year: currentYear,
      amount: "1200.00",
    },
  });

  await prisma.budget.create({
    data: {
      userId: user.id,
      categoryId: userCategories["Food"],
      month: currentMonth,
      year: currentYear,
      amount: "300.00",
    },
  });

  // --- One active recurring expense for the USER. ---
  const nextRunDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
  await prisma.recurringExpense.create({
    data: {
      userId: user.id,
      categoryId: userCategories["Bills"],
      amount: "15.99",
      description: "Streaming subscription (monthly)",
      frequency: "MONTHLY",
      nextRunDate,
      active: true,
    },
  });

  console.log("Seed complete:");
  console.log(`  Admin:  admin@demo.com / ${DEMO_PASSWORD} (role ADMIN)`);
  console.log(`  User:   user@demo.com / ${DEMO_PASSWORD} (role USER)`);
  console.log(`  Categories seeded for both demo users (${DEFAULT_CATEGORIES.length} each).`);
  console.log(`  Expenses seeded for user@demo.com: ${sampleExpenses.length}`);
  console.log(`  Budgets seeded for user@demo.com: 2 (1 overall, 1 category)`);
  console.log(`  Recurring expenses seeded for user@demo.com: 1`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
