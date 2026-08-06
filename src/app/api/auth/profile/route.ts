import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { connectDB } from "@/lib/db";
import { requireAuth, updateProfile, completeProfile } from "@/lib/services/auth";
import { updateProfileSchema, validate } from "@/lib/validation";

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
    const { data: parsed, error: validationError } = validate(updateProfileSchema, body);
    if (validationError) return validationError;

    await updateProfile(user.id, parsed);
    await completeProfile(user.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}