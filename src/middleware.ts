// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const token = req.cookies.get("OE_AUTH")?.value;
  const role = req.cookies.get("OE_ROLE")?.value;

  const isApp =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/client") ||
    pathname.startsWith("/supplier") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/users"); // admin area

  // 1) Block app routes if not logged in -> /login?next=...
  if (isApp && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  // 2) Admin-only section
  if (pathname.startsWith("/users") && role !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // 3) If already logged in, skip /login
  if (pathname === "/login" && token) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/projects/:path*",
    "/client/:path*",
    "/supplier/:path*",
    "/reports/:path*",
    "/users/:path*",
  ],
};