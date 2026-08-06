import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isDatabaseConfigured } from "@/lib/env";
import { requireAuth } from "@/lib/services/auth";
import { getCalendar, createEvent, updateEvent, deleteEvent } from "@/lib/services/directory";
import { validate } from "@/lib/validation";

const typeSchema = z.enum(["holiday", "event", "birthday", "anniversary", "other"]);

const createSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  type: typeSchema.optional().default("event"),
  date: z.string().min(1, "Date is required"),
  all_day: z.boolean().optional().default(true),
  time: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  recurring: z.boolean().optional().default(false),
});

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  type: typeSchema.optional(),
  date: z.string().min(1).optional(),
  all_day: z.boolean().optional(),
  time: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  recurring: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || undefined;
    const data = await getCalendar(user, month);
    return NextResponse.json(data || { events: [], month: "" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Calendar GET error:", error);
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
    const result = await createEvent(user, parsed.data);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 400 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Insufficient permissions") return NextResponse.json({ error: msg }, { status: 403 });
    console.error("Calendar create error:", error);
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
    const parsed = validate(updateSchema, body);
    if (parsed.error) return parsed.error;
    const result = await updateEvent(user, parsed.data);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Insufficient permissions") return NextResponse.json({ error: msg }, { status: 403 });
    console.error("Calendar update error:", error);
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
    if (!id) return NextResponse.json({ error: "Event id required" }, { status: 400 });
    const result = await deleteEvent(user, id);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Insufficient permissions") return NextResponse.json({ error: msg }, { status: 403 });
    console.error("Calendar delete error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}