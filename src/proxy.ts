import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "./lib/supabase-server";

const publicRoutes = new Set(["/", "/login"]);
const apiPrefix = "/api/";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow public routes
  if (publicRoutes.has(pathname)) {
    return NextResponse.next();
  }

  // Allow API auth endpoint (POST for login is unauthenticated)
  if (pathname === "/api/auth" && request.method === "POST") {
    return NextResponse.next();
  }

  // Allow static assets
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // API routes still need authentication enforced at handler level
  if (pathname.startsWith(apiPrefix)) {
    return NextResponse.next();
  }

  // Check authentication for page routes
  try {
    const supabase = await createServerClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
  } catch {
    // If auth check fails, allow through (handler-level auth will catch it)
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
