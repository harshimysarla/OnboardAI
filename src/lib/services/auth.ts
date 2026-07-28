import { createServerClient } from "@/lib/supabase-server";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase";

export interface AuthenticatedUser {
  id: string;
  email: string;
  full_name: string;
  company_id: string;
  company_name: string;
  role: "admin" | "hr" | "manager" | "employee";
  employee_id?: string;
  avatar_url?: string;
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, companies(name)")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email || "",
    full_name: profile.full_name,
    company_id: profile.company_id,
    company_name: profile.companies?.name || "",
    role: profile.role,
    employee_id: employee?.id,
    avatar_url: profile.avatar_url,
  };
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Authentication required");
  return user;
}

export async function requireRole(...roles: string[]): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) throw new Error("Insufficient permissions");
  return user;
}

export async function createProfile(params: {
  id: string;
  company_id: string;
  full_name: string;
  role: string;
}): Promise<void> {
  if (!supabaseAdmin) throw new Error("Supabase admin client not configured");
  const { error } = await supabaseAdmin.from("profiles").insert(params);
  if (error) throw error;
}
