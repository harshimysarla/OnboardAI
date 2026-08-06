import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { connectDB } from "@/lib/db";
import { Company } from "@/lib/models";
import { requireAuth } from "@/lib/services/auth";
import { serializeDoc } from "@/lib/serialize";

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    const conn = await connectDB();
    if (!conn) throw new Error("Database not configured");

    const company = await Company.findById(user.company_id).lean();
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const data = serializeDoc(company) as Record<string, unknown> & { access_code?: string };
    // Only the admin can view the company access code.
    if (user.role !== "admin") {
      delete data.access_code;
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Company API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}