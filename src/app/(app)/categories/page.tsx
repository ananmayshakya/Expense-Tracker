import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import CategoriesClient from "./CategoriesClient";

/**
 * Categories page (§9.3). Server Component: loads ONLY the current user's
 * categories — never another user's — and hands them to the client
 * component for interactivity. Mutations go through the server actions in
 * `src/actions/categories.ts`, which re-verify ownership server-side.
 */
export default async function CategoriesPage() {
  const session = await requireSession();

  const categories = await prisma.category.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      isDefault: true,
    },
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-[#1c1a17] dark:text-white">
          Categories
        </h1>
        <p className="mt-1 text-sm text-[#6f6a60] dark:text-[#9aa0b4]">
          Organize your expenses with custom categories and colors.
        </p>
      </div>

      <CategoriesClient initialCategories={categories} />
    </div>
  );
}
