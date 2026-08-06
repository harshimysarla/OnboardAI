import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { requireAuth } from "@/lib/services/auth";
import { getEmployeeTasks, completeTask } from "@/lib/services/tasks";
import { completeTaskSchema, validate } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    if (!employeeId) {
      return NextResponse.json({ error: "Missing employeeId" }, { status: 400 });
    }

    if (user.role === "employee" && user.employee_id !== employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tasks = await getEmployeeTasks(employeeId);
    return NextResponse.json(tasks || []);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Tasks API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const body = await request.json();
    const { data: parsed, error: validationError } = validate(completeTaskSchema, body);
    if (validationError) return validationError;

    const user = await requireAuth();
    const { employee_id, task_id } = parsed;

    if (user.role === "employee" && user.employee_id !== employee_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await completeTask(employee_id, task_id, user.company_id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Complete task error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}