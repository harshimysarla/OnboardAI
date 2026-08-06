import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/services/auth";
import { getEmployeeDashboard } from "@/lib/services/dashboard";

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    const conn = await connectDB();
    if (!conn) throw new Error("Database not configured");

    if (user.role === "employee") {
      const data = await getEmployeeDashboard();
      if (!data) return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
      return NextResponse.json(data);
    }

    // Admin / HR / manager dashboards reuse the standard company endpoints.
    return NextResponse.json({ error: "Dashboard available for employees only" }, { status: 403 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}