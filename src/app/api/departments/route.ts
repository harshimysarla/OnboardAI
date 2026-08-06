import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { requireAuth } from "@/lib/services/auth";
import { listDepartments, createDepartment } from "@/lib/services/employees";
import { createDepartmentSchema, validate } from "@/lib/validation";

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }
    const user = await requireAuth();
    const departments = await listDepartments(user.company_id);
    return NextResponse.json(departments);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Departments API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    if (user.role !== "admin" && user.role !== "hr") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { data: parsed, error: validationError } = validate(createDepartmentSchema, body);
    if (validationError) return validationError;

    const department = await createDepartment(user.company_id, parsed.name);
    return NextResponse.json(department, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required" || msg === "Insufficient permissions") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("Create department error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}