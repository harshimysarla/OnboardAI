import { createServerClient } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireAuth } from "./auth";
import { updateEmployeeProgress } from "./employees";

export async function getEmployeeTasks(employeeId: string) {
  if (!isSupabaseConfigured) return null;
  const user = await requireAuth();
  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("employee_tasks")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("company_id", user.company_id)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function completeTask(employeeId: string, taskId: string, companyId: string) {
  const supabase = await createServerClient();
  if (!supabase) throw new Error("Database not configured");

  const { error } = await supabase
    .from("employee_tasks")
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("employee_id", employeeId);

  if (error) throw error;

  await updateEmployeeProgress(employeeId, companyId);

  await supabase.from("activity_logs").insert({
    company_id: companyId,
    employee_id: employeeId,
    action: "Task completed",
    details: `Task ${taskId} marked complete`,
  });
}
