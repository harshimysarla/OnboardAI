import { createServerClient } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireAuth } from "./auth";

export async function getSupportRequests() {
  if (!isSupabaseConfigured) return null;
  const user = await requireAuth();
  const supabase = await createServerClient();
  if (!supabase) return null;

  let query = supabase
    .from("support_requests")
    .select("*")
    .eq("company_id", user.company_id)
    .order("created_at", { ascending: false });

  // Employees can only see their own requests
  if (user.role === "employee" && user.employee_id) {
    query = query.eq("employee_id", user.employee_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createSupportRequest(params: {
  employee_id: string;
  company_id: string;
  employee_name: string;
  department: string;
  category: string;
  type: string;
  description: string;
  priority: string;
}) {
  const supabase = await createServerClient();
  if (!supabase) throw new Error("Database not configured");

  const { data, error } = await supabase
    .from("support_requests")
    .insert({
      company_id: params.company_id,
      employee_id: params.employee_id,
      employee_name: params.employee_name,
      department: params.department,
      category: params.category,
      type: params.type,
      description: params.description,
      priority: params.priority,
      status: "Open",
    })
    .select()
    .single();

  if (error) throw error;

  await supabase.from("activity_logs").insert({
    company_id: params.company_id,
    employee_id: params.employee_id,
    action: "Request created",
    details: `${params.type} request (${params.category})`,
  });

  return data;
}

export async function updateRequestStatus(requestId: string, status: string) {
  const user = await requireAuth();
  const supabase = await createServerClient();
  if (!supabase) throw new Error("Database not configured");

  if (user.role === "employee") throw new Error("Only HR can update request status");

  const { error } = await supabase
    .from("support_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("company_id", user.company_id);

  if (error) throw error;
}
