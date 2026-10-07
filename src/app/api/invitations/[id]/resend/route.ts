import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/services/auth";
import { resendInvitation } from "@/lib/services/employees";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }

    const user = await requireRole("admin", "hr");
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const p = await params;
    const id = p.id;
    if (!id) return NextResponse.json({ error: "Missing invitation ID" }, { status: 400 });

    const result = await resendInvitation(id, user.company_id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    if (msg === "Insufficient permissions") {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg === "Invitation not found" || msg === "User not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg === "Cannot resend completed invitation") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("Resend invitation error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
