import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createServerClient } from "@/lib/supabase-server";
import { chat } from "@/lib/services/ai";
import { chatSchema, validate } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
    }

    const body = await request.json();
    const { data: parsed, error: validationError } = validate(chatSchema, body);
    if (validationError) return validationError;

    const { messages, employeeId: clientEmployeeId } = parsed;

    let companyId = "";
    let employeeId = clientEmployeeId || "";

    const supabase = await createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    companyId = profile.company_id;

    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (emp) {
      employeeId = emp.id;
    }

    const result = await chat(messages, user.id, companyId, employeeId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
