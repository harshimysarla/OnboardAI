import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createServerClient } from "@/lib/supabase-server";
import { requireAuth } from "@/lib/services/auth";
import { getEmployees, createEmployee, getMyProfile } from "@/lib/services/employees";
import { demoService } from "@/lib/demo-service";
import { createEmployeeSchema, validate } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("id");

    if (isSupabaseConfigured) {
      const user = await requireAuth().catch(() => null);
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      if (employeeId) {
        const supabase = await createServerClient();
        if (supabase) {
          const { data } = await supabase
            .from("employees")
            .select("*, departments(name)")
            .eq("id", employeeId)
            .single();
          if (data) {
            return NextResponse.json({ ...data, department: data.departments?.name || "" });
          }
          return NextResponse.json(null);
        }
      }

      if (user.role === "employee" && user.employee_id) {
        const profile = await getMyProfile();
        return NextResponse.json(profile ? [profile] : []);
      }

      const employees = await getEmployees();
      return NextResponse.json(employees || []);
    }

    // Demo mode
    if (employeeId) {
      const emp = await demoService.getEmployeeById(employeeId);
      return NextResponse.json(emp);
    }
    const employees = await demoService.getEmployees();
    return NextResponse.json(employees);
  } catch (error: any) {
    console.error("Employees API error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data: parsed, error: validationError } = validate(createEmployeeSchema, body);
    if (validationError) return validationError;

    const { full_name, email, job_title, department, department_id, manager, joining_date } = parsed;
    const dept = department_id || department || "";

    if (isSupabaseConfigured) {
      const user = await requireAuth().catch(() => null);
      if (!user || (user.role !== "admin" && user.role !== "hr")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // company_id is resolved server-side — never trust client-provided company_id
      const employee = await createEmployee({
        full_name, email, job_title: job_title || full_name,
        department_id: dept, company_id: user.company_id,
        manager: manager || "", joining_date,
      });
      return NextResponse.json(employee, { status: 201 });
    }

    // Demo mode
    const employee = await demoService.createEmployee({
      full_name, email, job_title: job_title || full_name,
      department: dept || "Engineering",
      manager: manager || "", joining_date,
    });
    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    console.error("Create employee error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
