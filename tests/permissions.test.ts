import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";

import { assertOwnerOrAdmin, ForbiddenError } from "@/lib/permissions";

/**
 * PLAN.md §11 item 1 — `assertOwnerOrAdmin`:
 * - allows the owner (same id)
 * - allows an ADMIN (different id)
 * - throws ForbiddenError for a different non-admin user
 *
 * Minimal Session-shaped objects are constructed inline (only the fields
 * `assertOwnerOrAdmin` actually reads: user.id, user.role).
 */

function makeSession(id: string, role: "USER" | "ADMIN"): Session {
  return {
    user: {
      id,
      role,
      currency: "USD",
      theme: "system",
      // DefaultSession["user"] fields — not read by assertOwnerOrAdmin but
      // present to satisfy the augmented Session type.
      name: null,
      email: `${id}@example.com`,
      image: null,
    },
    expires: new Date(Date.now() + 60_000).toISOString(),
  };
}

describe("assertOwnerOrAdmin", () => {
  it("allows the owner (same id)", () => {
    const session = makeSession("user-1", "USER");
    expect(() => assertOwnerOrAdmin("user-1", session)).not.toThrow();
  });

  it("allows an ADMIN acting on a different user's resource", () => {
    const session = makeSession("admin-1", "ADMIN");
    expect(() => assertOwnerOrAdmin("user-1", session)).not.toThrow();
  });

  it("throws ForbiddenError for a different non-admin user", () => {
    const session = makeSession("user-2", "USER");
    expect(() => assertOwnerOrAdmin("user-1", session)).toThrow(ForbiddenError);
  });
});
