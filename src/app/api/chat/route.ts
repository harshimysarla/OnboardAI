import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createServerClient } from "@/lib/supabase-server";
import { chat } from "@/lib/services/ai";
import { chatSchema, validate } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data: parsed, error: validationError } = validate(chatSchema, body);
    if (validationError) return validationError;

    const { messages, employeeId: clientEmployeeId, employeeName: clientEmployeeName } = parsed;

    // Get authenticated user
    let userId = clientEmployeeId || "";
    let companyId = "demo-company";
    let employeeId = clientEmployeeId || "";
    let employeeName = clientEmployeeName || "";

    if (isSupabaseConfigured) {
      const supabase = await createServerClient();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
          const { data: profile } = await supabase
            .from("profiles")
            .select("company_id")
            .eq("id", user.id)
            .single();
          if (profile) {
            companyId = profile.company_id;
          }
          const { data: emp } = await supabase
            .from("employees")
            .select("id, full_name")
            .eq("profile_id", user.id)
            .maybeSingle();
          if (emp) {
            employeeId = emp.id;
            employeeName = emp.full_name;
          }
        }
      }
    } else {
      // Demo mode: use values from client
      if (clientEmployeeId) {
        const { demoService } = await import("@/lib/demo-service");
        const emp = await demoService.getEmployeeById(clientEmployeeId);
        if (emp) {
          employeeName = emp.full_name;
          companyId = "demo-company";
        }
      }
    }

    const result = await chat(messages, userId, companyId, employeeId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
