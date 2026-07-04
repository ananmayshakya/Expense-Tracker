import type { Role } from "@/generated/prisma/client";
import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

/**
 * Module augmentation so `session.user.role` / `.currency` / `.theme` (and
 * the equivalent JWT fields) are typed end-to-end instead of `any`.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      currency: string;
      theme: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    role: Role;
    currency: string;
    theme: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: Role;
    currency: string;
    theme: string;
  }
}
