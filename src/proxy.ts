import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isDatabaseConfigured } from "./lib/env";

const publicRoutes = new Set(["/", "/login", "/register"]);
const apiPrefix = "/api/";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "");

async function getSessionUser(request: NextRequest) {
  if (!process.env.JWT_SECRET) return null;
  const token = request.cookies.get("onboardai_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    return {
      userId: payload.sub as string,
      role: (payload.role as string) || "employee",
      companyId: (payload.companyId as string) || "",
    };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow static assets
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Allow API auth endpoint (POST for login is unauthenticated)
  if (pathname === "/api/auth" && request.method === "POST") {
    return NextResponse.next();
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.next();
  }

  const user = await getSessionUser(request);

  // Check authentication for page routes
  if (!pathname.startsWith(apiPrefix)) {
    if (!user && !publicRoutes.has(pathname)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (user && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  const response = NextResponse.next();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};