import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { getPerformanceData, createGoal, updateGoalProgress, createReview } from "@/lib/services/performance";

export async function GET(request: Request) {
  try {
    if (!isDatabaseConfigured()) return NextResponse.json({ error: "DB not configured" }, { status: 400 });
    
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId") || undefined;
    
    const data = await getPerformanceData(employeeId);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isDatabaseConfigured()) return NextResponse.json({ error: "DB not configured" }, { status: 400 });
    
    const body = await request.json();
    const { action, ...data } = body;
    
    let result;
    if (action === "create_goal") {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      result = await createGoal(data as any);
    } else if (action === "update_goal") {
      result = await updateGoalProgress(data.id, data.progress, data.status);
    } else if (action === "create_review") {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      result = await createReview(data as any);
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Unauthorized" || msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg || "Internal error" }, { status: 500 });
  }
}
