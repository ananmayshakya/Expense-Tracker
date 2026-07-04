import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig from "@/auth.config";

/**
 * VERSION-REALITY NOTE: Next.js 16 renamed the `middleware.ts` file
 * convention to `proxy.ts` (exported function must be named `proxy`, not
 * `middleware`). The `edge` runtime is no longer supported for this file —
 * Proxy always runs on the Node.js runtime in Next 16. See
 * node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md
 * ("`middleware` to `proxy`") and .../03-file-conventions/proxy.md.
 *
 * We still build this from the edge-safe `auth.config.ts` (no Prisma/bcrypt)
 * rather than the full `auth.ts`, per PLAN.md §7's split-config pattern —
 * this keeps the proxy on the lightweight JWT-only check (no DB round trip)
 * even though Node APIs would technically be available here now.
 */
const { auth } = NextAuth(authConfig);

const AUTH_PAGES = ["/login", "/register"];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (auth/register handle their own auth)
     * - _next/static, _next/image (static assets)
     * - favicon.ico and other metadata files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
};
