import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createServerClient } from "@/lib/supabase-server";
import { requireAuth } from "@/lib/services/auth";
import { demoService } from "@/lib/demo-service";
import { completeTaskSchema, validate } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    if (!employeeId) {
      return NextResponse.json({ error: "Missing employeeId" }, { status: 400 });
    }

    if (isSupabaseConfigured) {
      const user = await requireAuth().catch(() => null);
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const supabase = await createServerClient();
      if (!supabase) return NextResponse.json([]);

      // Employees can only see their own tasks
      if (user.role === "employee" && user.employee_id !== employeeId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { data } = await supabase
        .from("employee_tasks")
        .select("*")
        .eq("employee_id", employeeId)
        .order("sort_order", { ascending: true });
      return NextResponse.json(data || []);
    }

    const tasks = await demoService.getEmployeeTasks(employeeId);
    return NextResponse.json(tasks);
  } catch (error: any) {
    console.error("Tasks API error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data: parsed, error: validationError } = validate(completeTaskSchema, body);
    if (validationError) return validationError;

    let { employee_id, task_id } = parsed;

    if (isSupabaseConfigured) {
      const user = await requireAuth().catch(() => null);
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      // For employees, resolve employee_id from auth; admins/hr can act on behalf
      if (user.role === "employee") {
        if (user.employee_id !== employee_id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else if (user.employee_id) {
        // Admin/hr acting on behalf — use provided employee_id (validated by RLS)
      }

      const supabase = await createServerClient();
      if (!supabase) return NextResponse.json({ error: "Server error" }, { status: 500 });

      await supabase
        .from("employee_tasks")
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq("id", task_id);

      const { data: tasks } = await supabase
        .from("employee_tasks")
        .select("completed")
        .eq("employee_id", employee_id);
      if (tasks && tasks.length > 0) {
        const completed = tasks.filter((t: any) => t.completed).length;
        const progress = Math.round((completed / tasks.length) * 100);
        await supabase.from("employees").update({ progress }).eq("id", employee_id);
      }
      return NextResponse.json({ success: true });
    }

    await demoService.completeTask(employee_id, task_id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Complete task error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
