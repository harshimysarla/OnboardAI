import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { connectDB } from "@/lib/db";
import { requireAuth, acceptPolicies } from "@/lib/services/auth";

export async function POST() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conn = await connectDB();
    if (!conn) throw new Error("Database not configured");

    await acceptPolicies(user.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Accept policies error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}