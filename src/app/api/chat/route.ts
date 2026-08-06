import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { requireAuth } from "@/lib/services/auth";
import { chat } from "@/lib/services/ai";
import { chatSchema, validate } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const body = await request.json();
    const { data: parsed, error: validationError } = validate(chatSchema, body);
    if (validationError) return validationError;

    const { messages, employeeId: clientEmployeeId } = parsed;

    const user = await requireAuth();
    const employeeId = clientEmployeeId || user.employee_id || "";

    const result = await chat(messages, user.id, user.company_id, employeeId);
    return NextResponse.json({
      response: result.response,
      intent: result.intent,
      intentDetails: result.intent,
      sources: result.sources,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}