import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { requireAuth } from "@/lib/services/auth";
import { applyLeave, cancelLeave, getMyLeaves, getPendingLeaves, decideLeave, getLeaveAnalytics } from "@/lib/services/leave";
import { applyLeaveSchema, decideLeaveSchema, validate } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "mine";

    if (scope === "pending") {
      const data = await getPendingLeaves(user);
      return NextResponse.json(data || { requests: [] });
    }
    if (scope === "analytics") {
      const data = await getLeaveAnalytics(user);
      return NextResponse.json(data || { total: 0, thisMonth: 0, pending: 0, byType: [] });
    }

    const data = await getMyLeaves(user);
    return NextResponse.json(data || { requests: [], balances: {} });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Leaves GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    if (!user.employee_id) {
      return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = validate(applyLeaveSchema, body);
    if (parsed.error) return parsed.error;

    const result = await applyLeave(user, parsed.data);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 400 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Leaves POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    const body = await request.json();
    const parsed = validate(decideLeaveSchema, body);
    if (parsed.error) return parsed.error;

    const result = await decideLeave(user, parsed.data.id, parsed.data.decision);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Leaves PATCH error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Leave request id required" }, { status: 400 });

    const result = await cancelLeave(user, id);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Leaves DELETE error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}