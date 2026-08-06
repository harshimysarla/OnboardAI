import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/services/auth";
import { updateCompanyAccessCode, ACCESS_CODE_TAKEN_MESSAGE, ACCESS_CODE_INVALID_MESSAGE } from "@/lib/services/company";
import { changeAccessCodeSchema, validate } from "@/lib/validation";

export async function PATCH(request: Request) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireRole("admin");

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      // No body -> regenerate a random code (legacy behavior).
    }
    const parsed = validate(changeAccessCodeSchema, body);
    if (parsed.error) return parsed.error;

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "";

    const result = await updateCompanyAccessCode(user, {
      code: parsed.data.code,
      ip,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required" || msg === "Insufficient permissions") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    if (msg === "Company not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg === ACCESS_CODE_TAKEN_MESSAGE || msg === ACCESS_CODE_INVALID_MESSAGE) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("Change access code error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
