import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { requireAuth } from "@/lib/services/auth";
import {
  listTraining,
  createCourse,
  updateCourse,
  deleteCourse,
  assignCourse,
} from "@/lib/services/training";
import { validate } from "@/lib/validation";
import { z } from "zod";

const materialSchema = z.object({
  title: z.string().min(1, "Material title is required"),
  type: z.enum(["video", "document", "link", "quiz"]),
  url: z.string().optional(),
  content: z.string().optional(),
  duration_min: z.number().int().min(0).optional(),
  questions: z.array(z.object({
    question: z.string().min(1),
    options: z.array(z.string()).min(2),
    answer_index: z.number().int().min(0),
  })).optional(),
});

const createSchema = z.object({
  title: z.string().min(1, "Course title is required"),
  description: z.string().optional(),
  category: z.enum(["compliance", "onboarding", "skills", "safety", "product", "other"]).optional().default("other"),
  is_mandatory: z.boolean().optional().default(false),
  materials: z.array(materialSchema).optional().default([]),
});

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.enum(["compliance", "onboarding", "skills", "safety", "product", "other"]).optional(),
  is_mandatory: z.boolean().optional(),
  materials: z.array(materialSchema).optional(),
});

const assignSchema = z.object({
  course_id: z.string().min(1),
  action: z.literal("assign"),
  employee_ids: z.array(z.string().min(1)).min(1, "Select at least one employee"),
});

export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || undefined;
    const data = await listTraining(user, scope);
    return NextResponse.json(data || { courses: [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Training GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }
    const user = await requireAuth();
    const body = await request.json();
    const parsed = validate(createSchema, body);
    if (parsed.error) return parsed.error;
    return NextResponse.json(await createCourse(user, parsed.data), { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Insufficient permissions") return NextResponse.json({ error: msg }, { status: 403 });
    console.error("Training create error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }
    const user = await requireAuth();
    const body = await request.json();

    if (body && body.action === "assign") {
      const parsed = validate(assignSchema, body);
      if (parsed.error) return parsed.error;
      const result = await assignCourse(user, parsed.data.course_id, parsed.data.employee_ids);
      if (result && typeof result === "object" && "error" in result) {
        return NextResponse.json({ error: (result as { error: string }).error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    const parsed = validate(updateSchema, body);
    if (parsed.error) return parsed.error;
    const result = await updateCourse(user, parsed.data);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Insufficient permissions") return NextResponse.json({ error: msg }, { status: 403 });
    console.error("Training update error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Course id required" }, { status: 400 });
    const result = await deleteCourse(user, id);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Insufficient permissions") return NextResponse.json({ error: msg }, { status: 403 });
    console.error("Training delete error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}