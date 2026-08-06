import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { authSchema, validate } from "@/lib/validation";
import {
  getAuthenticatedUser,
  loginUser,
  logoutUser,
  rotateRefreshToken,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/services/auth";
import { cookies } from "next/headers";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ user: null });
  }

  let user = await getAuthenticatedUser();

  // Access token invalid/expired — try rotating with refresh token
  if (!user) {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
    if (refreshToken) {
      try {
        const rotated = await rotateRefreshToken(refreshToken);
        if (rotated) {
          user = await getAuthenticatedUser();
        }
      } catch {
        await logoutUser();
      }
    }
  }

  return NextResponse.json({ user });
}

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { data: parsed, error: validationError } = validate(authSchema, body);
    if (validationError) return validationError;

    const result = await loginUser(parsed.company_code, parsed.email, parsed.password);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE() {
  await logoutUser();
  return NextResponse.json({ success: true });
}