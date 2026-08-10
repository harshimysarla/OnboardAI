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
    if (msg === "Registration is disabled") {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg === "An account with this email already exists") {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}