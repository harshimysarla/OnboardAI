import { createServerClient } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireAuth } from "./auth";

export async function getEmployees() {
  if (!isSupabaseConfigured) return null;
  const user = await requireAuth();
  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("employees")
    .select("*, departments(name)")
    .eq("company_id", user.company_id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map((e: Record<string, unknown>) => ({
    ...e,
    department: (e.departments as Record<string, unknown> | null)?.name || (e.department as string) || "",
  }));
}

export async function getEmployeeById(id: string) {
  if (!isSupabaseConfigured) return null;
  const user = await requireAuth();
  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("employees")
    .select("*, departments(name)")
    .eq("id", id)
    .eq("company_id", user.company_id)
    .single();

  if (error) throw error;
  return { ...data, department: data.departments?.name || "" };
}

export async function getMyProfile() {
  if (!isSupabaseConfigured) return null;
  const user = await requireAuth();
  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("employees")
    .select("*, departments(name)")
    .eq("profile_id", user.id)
    .eq("company_id", user.company_id)
    .maybeSingle();

  if (error) throw error;
  return data ? { ...data, department: data.departments?.name || "" } : null;
}

export async function getOnboardingTemplate(companyId: string) {
  const supabase = await createServerClient();
  if (!supabase) return null;

  let { data: template } = await supabase
    .from("onboarding_templates")
    .select("id")
    .eq("company_id", companyId)
    .eq("scope", "company")
    .maybeSingle();

  if (!template) {
    const { data: created } = await supabase
      .from("onboarding_templates")
      .insert({
        company_id: companyId,
        name: "Default Onboarding",
        scope: "company",
      })
      .select()
      .single();
    template = created;
  }

  if (!template) return null;

  const { data: tasks } = await supabase
    .from("onboarding_tasks")
    .select("*")
    .eq("template_id", template.id)
    .order("sort_order", { ascending: true });

  return { template, tasks: tasks || [] };
}

export async function createEmployee(params: {
  full_name: string;
  email: string;
  job_title: string;
  department_id: string;
  company_id: string;
  manager: string;
  joining_date: string;
}) {
  const supabase = await createServerClient();
  if (!supabase) throw new Error("Database not configured");

  const { data, error } = await supabase
    .from("employees")
    .insert({
      company_id: params.company_id,
      full_name: params.full_name,
      email: params.email,
      job_title: params.job_title,
      department_id: params.department_id,
      manager: params.manager,
      joining_date: params.joining_date,
      progress: 0,
      risk_level: "green",
    })
    .select()
    .single();

  if (error) throw error;

  const templateData = await getOnboardingTemplate(params.company_id);
  const templateTasks = templateData?.tasks || [];

  if (templateTasks.length > 0) {
    const employeeTasks = templateTasks.map((t: Record<string, unknown>) => {
      const dueDate = new Date(params.joining_date);
      if (t.category === "first_week") dueDate.setDate(dueDate.getDate() + 7);
      else if (t.category === "first_month") dueDate.setDate(dueDate.getDate() + 30);
      return {
        employee_id: data.id,
        company_id: params.company_id,
        title: t.title,
        description: t.description || "",
        category: t.category || "day1",
        mandatory: t.mandatory !== false,
        completed: false,
        due_date: dueDate.toISOString().split("T")[0],
        sort_order: t.sort_order || 0,
      };
    });

    const { error: taskError } = await supabase
      .from("employee_tasks")
      .insert(employeeTasks);
    if (taskError) console.error("Failed to assign tasks:", taskError);
  }

  await supabase.from("activity_logs").insert({
    company_id: params.company_id,
    employee_id: data.id,
    action: "Employee created",
    details: `${params.full_name} was added as ${params.job_title}`,
  });

  return data;
}

export async function updateEmployeeProgress(employeeId: string, companyId: string) {
  const supabase = await createServerClient();
  if (!supabase) return;

  const { data: tasks } = await supabase
    .from("employee_tasks")
    .select("completed")
    .eq("employee_id", employeeId);

  if (!tasks || tasks.length === 0) return;
  const completed = tasks.filter((t: Record<string, unknown>) => t.completed).length;
  const progress = Math.round((completed / tasks.length) * 100);

  await supabase
    .from("employees")
    .update({ progress, updated_at: new Date().toISOString() })
    .eq("id", employeeId)
    .eq("company_id", companyId);
}
