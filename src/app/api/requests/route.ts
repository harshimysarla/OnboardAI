import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireAuth } from "@/lib/services/auth";
import { getSupportRequests, createSupportRequest, updateRequestStatus } from "@/lib/services/requests";
import { demoService } from "@/lib/demo-service";
import { createRequestSchema, updateRequestSchema, validate } from "@/lib/validation";

export async function GET() {
  try {
    if (isSupabaseConfigured) {
      await requireAuth();
      const requests = await getSupportRequests();
      return NextResponse.json(requests || []);
    }
    const requests = await demoService.getSupportRequests();
    return NextResponse.json(requests);
  } catch (error: any) {
    console.error("Requests API error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data: parsed, error: validationError } = validate(createRequestSchema, body);
    if (validationError) return validationError;

    let { employee_id, employee_name, department, category, type, description, priority } = parsed;

    if (isSupabaseConfigured) {
      const user = await requireAuth();

      // Resolve identity server-side: employees can only create requests for themselves
      if (user.role === "employee") {
        employee_id = user.employee_id || employee_id;
      }

      const newRequest = await createSupportRequest({
        employee_id, company_id: user.company_id,
        employee_name: employee_name || "", department: department || "",
        category, type, description, priority,
      });
      return NextResponse.json(newRequest, { status: 201 });
    }

    const newRequest = await demoService.createSupportRequest({
      employee_id, employee_name, department,
      category, type, description,
      priority, status: "Open",
    });
    return NextResponse.json(newRequest, { status: 201 });
  } catch (error: any) {
    console.error("Create request error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { data: parsed, error: validationError } = validate(updateRequestSchema, body);
    if (validationError) return validationError;

    const { id, status } = parsed;

    if (isSupabaseConfigured) {
      await updateRequestStatus(id, status);
    } else {
      await demoService.updateRequestStatus(id, status);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Update request error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
