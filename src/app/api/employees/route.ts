import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { requireAuth } from "@/lib/services/auth";
import { getEmployees, createEmployee, getMyProfile, getEmployeeById } from "@/lib/services/employees";
import { createEmployeeSchema, validate } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("id");

    if (employeeId) {
      const employee = await getEmployeeById(employeeId);
      return NextResponse.json(employee);
    }

    if (user.role === "employee" && user.employee_id) {
      const profile = await getMyProfile();
      return NextResponse.json(profile ? [profile] : []);
    }

    const employees = await getEmployees();
    return NextResponse.json(employees || []);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Employees API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const body = await request.json();
    const { data: parsed, error: validationError } = validate(createEmployeeSchema, body);
    if (validationError) return validationError;

    const user = await requireAuth();
    if (user.role !== "admin" && user.role !== "hr") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { full_name, email, job_title, department, department_id, manager, joining_date } = parsed;
    const dept = department_id || department || "";

    const employee = await createEmployee({
      full_name, email, job_title: job_title || full_name,
      department_id: dept, company_id: user.company_id,
      manager: manager || "", joining_date,
    });
    return NextResponse.json(employee, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required" || msg === "Insufficient permissions") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("Create employee error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}