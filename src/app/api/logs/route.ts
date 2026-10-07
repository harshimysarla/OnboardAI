import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/services/auth";
import { getLogs } from "@/lib/services/logs";

export async function GET(request: Request) {
  try {
    if (!isDatabaseConfigured()) return NextResponse.json({ error: "DB not configured" }, { status: 400 });
    
    await requireRole("admin", "hr");

    const { searchParams } = new URL(request.url);
    const limitStr = searchParams.get("limit");
    const limit = limitStr ? parseInt(limitStr, 10) : 50;

    const data = await getLogs(limit);
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === "Insufficient permissions") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    if (error.message === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
