import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { requireAuth } from "@/lib/services/auth";
import { getAssignment, startCourse, completeMaterial, submitQuiz } from "@/lib/services/training";
import { validate } from "@/lib/validation";
import { z } from "zod";

const progressSchema = z.object({
  course_id: z.string().min(1),
  action: z.enum(["start", "complete", "quiz"]),
  material_id: z.string().optional(),
  answers: z.array(z.number().int().min(0)).optional(),
});

export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("course_id");
    if (!courseId) return NextResponse.json({ error: "course_id required" }, { status: 400 });
    const data = await getAssignment(user, courseId);
    return NextResponse.json(data || null);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Training progress GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }
    const user = await requireAuth();
    if (!user.employee_id) {
      return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
    }
    const body = await request.json();
    const parsed = validate(progressSchema, body);
    if (parsed.error) return parsed.error;

    const { course_id, action, material_id, answers } = parsed.data;

    let result: unknown;
    if (action === "start") {
      result = await startCourse(user, course_id);
    } else if (action === "complete") {
      if (!material_id) return NextResponse.json({ error: "material_id required" }, { status: 400 });
      result = await completeMaterial(user, course_id, material_id);
    } else {
      if (!material_id) return NextResponse.json({ error: "material_id required" }, { status: 400 });
      result = await submitQuiz(user, course_id, material_id, answers || []);
    }

    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Training progress POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}