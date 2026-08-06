import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/services/auth";
import { listInvitations } from "@/lib/services/employees";
import { connectDB } from "@/lib/db";

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireRole("admin", "hr");
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conn = await connectDB();
    if (!conn) throw new Error("Database not configured");

    const invitations = await listInvitations(user.company_id);
    return NextResponse.json(invitations || []);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required" || msg === "Insufficient permissions") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("Invitations API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}