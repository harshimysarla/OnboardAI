import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { requireAuth } from "@/lib/services/auth";
import { getGamification } from "@/lib/services/gamification";

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }
    const user = await requireAuth();
    const data = await getGamification(user);
    return NextResponse.json(data || { points: 0, badges: [], rank: 0, total: 0, leaderboard: [], catalog: [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Gamification GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}