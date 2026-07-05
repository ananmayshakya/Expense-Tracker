import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // NOTE: do NOT re-declare `session` here — `authConfig.session` (in
  // auth.config.ts) carries `strategy: "jwt"` AND the §17-hardening
  // `maxAge`. Re-declaring `session: { strategy: "jwt" }` on this object
  // would overwrite (not merge with) the spread `authConfig.session` above,
  // silently dropping `maxAge` back to NextAuth's 30-day default.
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          return null;
        }

        const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordsMatch) {
          return null;
        }

        // Only return the safe, minimal fields the JWT/session need.
        // `passwordHash` must never leave this function.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          currency: user.currency,
          theme: user.theme,
        };
      },
    }),
  ],
});
