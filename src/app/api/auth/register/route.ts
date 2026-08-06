import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { registerSchema, validate } from "@/lib/validation";
import { registerUser } from "@/lib/services/auth";

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { data: parsed, error: validationError } = validate(registerSchema, body);
    if (validationError) return validationError;

    const result = await registerUser(parsed);
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}