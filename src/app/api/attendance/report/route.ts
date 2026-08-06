import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { connectDB } from "@/lib/db";
import { requireRole } from "@/lib/services/auth";
import { getReport } from "@/lib/services/attendance";

export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireRole("admin", "hr");
    const conn = await connectDB();
    if (!conn) throw new Error("Database not configured");

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || undefined;
    const employeeId = searchParams.get("employeeId") || undefined;

    const data = await getReport(user.company_id, { month, employeeId });
    return NextResponse.json(data || { records: [], summary: {
      present: 0, absent: 0, lateDays: 0, totalHours: 0, avgHours: 0, days: 0,
    } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required" || msg === "Insufficient permissions") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("Attendance report error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}