import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { requireAuth } from "@/lib/services/auth";
import { checkIn, checkOut, startBreak, endBreak, getMyMonth } from "@/lib/services/attendance";

const ACTIONS = ["check-in", "check-out", "break-start", "break-end"] as const;

export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    if (!user.employee_id && user.role === "employee") {
      return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || undefined;

    const data = await getMyMonth(user, month);
    return NextResponse.json(data || { records: [], summary: {} });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Attendance GET error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    const body = await request.json();
    const action = body.action as string;
    if (!ACTIONS.includes(action as (typeof ACTIONS)[number])) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const results: Record<string, unknown> = {
      "check-in": checkIn,
      "check-out": checkOut,
      "break-start": startBreak,
      "break-end": endBreak,
    };
    const fn = results[action] as (u: { id: string; company_id: string; employee_id?: string }) => Promise<unknown>;
    const result = await fn(user);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Attendance POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}