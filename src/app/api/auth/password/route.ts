import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { connectDB } from "@/lib/db";
import { requireAuth, changePassword } from "@/lib/services/auth";
import { changePasswordSchema, validate } from "@/lib/validation";

export async function PATCH(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conn = await connectDB();
    if (!conn) throw new Error("Database not configured");

    const body = await request.json();
    const { data: parsed, error: validationError } = validate(changePasswordSchema, body);
    if (validationError) return validationError;

    await changePassword(user.id, parsed.new_password);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}