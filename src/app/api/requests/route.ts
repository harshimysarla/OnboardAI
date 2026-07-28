import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireAuth } from "@/lib/services/auth";
import { getSupportRequests, createSupportRequest, updateRequestStatus } from "@/lib/services/requests";
import { createRequestSchema, updateRequestSchema, validate } from "@/lib/validation";

export async function GET() {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
    }
    await requireAuth();
    const requests = await getSupportRequests();
    return NextResponse.json(requests || []);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Requests API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
    }

    const body = await request.json();
    const { data: parsed, error: validationError } = validate(createRequestSchema, body);
    if (validationError) return validationError;

    const user = await requireAuth();

    const { employee_name, department, category, type, description, priority } = parsed;
    const empId = user.role === "employee" ? (user.employee_id || parsed.employee_id) : parsed.employee_id;

    const newRequest = await createSupportRequest({
      employee_id: empId, company_id: user.company_id,
      employee_name: employee_name || "", department: department || "",
      category, type, description, priority,
    });
    return NextResponse.json(newRequest, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create request error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
    }

    await requireAuth();

    const body = await request.json();
    const { data: parsed, error: validationError } = validate(updateRequestSchema, body);
    if (validationError) return validationError;

    const { id, status } = parsed;
    await updateRequestStatus(id, status);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required" || msg === "Insufficient permissions" || msg === "Only HR can update request status") {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("Update request error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
