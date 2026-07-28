import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { authSchema, validate } from "@/lib/validation";

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ user: null, mode: "demo" });
  }

  const supabase = await createServerClient();
  if (!supabase) {
    return NextResponse.json({ user: null, mode: "demo" });
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ user: null });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, companies(name)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ user: null });
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      full_name: profile.full_name,
      company_id: profile.company_id,
      company_name: profile.companies?.name || "",
      role: profile.role,
      employee_id: employee?.id,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const supabase = await createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { data: parsed, error: validationError } = validate(authSchema, body);
    if (validationError) return validationError;

    const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.email, password: parsed.password });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ session: data.session });
  } catch (e) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ success: true });
  }

  const supabase = await createServerClient();
  await supabase?.auth.signOut();
  return NextResponse.json({ success: true });
}
