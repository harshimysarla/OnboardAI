import { createServerClient } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireAuth } from "./auth";

export async function getCompanyPolicies() {
  if (!isSupabaseConfigured) return null;
  const user = await requireAuth();
  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("company_policies")
    .select("id, title, category, created_at")
    .eq("company_id", user.company_id)
    .order("title", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getPolicyById(id: string) {
  if (!isSupabaseConfigured) return null;
  const user = await requireAuth();
  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("company_policies")
    .select("*")
    .eq("id", id)
    .eq("company_id", user.company_id)
    .single();

  if (error) throw error;
  return data;
}

export async function createPolicy(params: {
  title: string;
  content: string;
  category: string;
}) {
  const user = await requireAuth();
  const supabase = await createServerClient();
  if (!supabase) throw new Error("Database not configured");

  const { data, error } = await supabase
    .from("company_policies")
    .insert({
      company_id: user.company_id,
      title: params.title,
      content: params.content,
      category: params.category,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePolicy(id: string, params: { title?: string; content?: string; category?: string }) {
  const user = await requireAuth();
  const supabase = await createServerClient();
  if (!supabase) throw new Error("Database not configured");

  const { data, error } = await supabase
    .from("company_policies")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", user.company_id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePolicy(id: string) {
  const user = await requireAuth();
  const supabase = await createServerClient();
  if (!supabase) throw new Error("Database not configured");

  const { error } = await supabase
    .from("company_policies")
    .delete()
    .eq("id", id)
    .eq("company_id", user.company_id);

  if (error) throw error;
}

export async function searchPolicies(query: string) {
  if (!isSupabaseConfigured) return null;
  const user = await requireAuth();
  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("company_policies")
    .select("id, title, content, category")
    .eq("company_id", user.company_id)
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .limit(5);

  if (error) throw error;
  return data;
}
