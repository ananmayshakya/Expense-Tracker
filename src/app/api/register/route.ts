import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";

// §9.3 default categories seeded for every new user.
const DEFAULT_CATEGORIES: Array<{ name: string; color: string }> = [
  { name: "Food", color: "#f59e0b" },
  { name: "Transport", color: "#3b82f6" },
  { name: "Bills", color: "#ef4444" },
  { name: "Entertainment", color: "#a855f7" },
  { name: "Shopping", color: "#ec4899" },
  { name: "Health", color: "#22c55e" },
  { name: "Other", color: "#6b7280" },
];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Only email/name/password are read — role or any other privileged field
  // sent by the client is ignored entirely. New users are always USER.
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name: name && name.length > 0 ? name : null,
      passwordHash,
      // role intentionally omitted — schema default (USER) applies.
      categories: {
        create: DEFAULT_CATEGORIES.map((category) => ({
          name: category.name,
          color: category.color,
          isDefault: true,
        })),
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      currency: true,
      theme: true,
      createdAt: true,
    },
  });

  // Only safe fields are returned — passwordHash never leaves the server.
  return NextResponse.json({ user }, { status: 201 });
}
