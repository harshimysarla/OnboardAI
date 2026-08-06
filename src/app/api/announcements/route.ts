import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isDatabaseConfigured } from "@/lib/env";
import { requireAuth } from "@/lib/services/auth";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleLike,
  toggleBookmark,
  addComment,
} from "@/lib/services/announcements";
import { validate } from "@/lib/validation";

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: z.enum(["general", "important", "event", "training"]).optional().default("general"),
  pinned: z.boolean().optional().default(false),
});

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  pinned: z.boolean().optional(),
});

const interactSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["like", "bookmark", "comment"]),
  content: z.string().min(1).optional(),
});

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }
    const user = await requireAuth();
    const data = await listAnnouncements(user);
    return NextResponse.json(data || { announcements: [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Announcements list error:", error);
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

    const result = await createAnnouncement(user, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "Insufficient permissions") {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("Announcements create error:", error);
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

    if (body && body.action && body.id) {
      const parsed = validate(interactSchema, body);
      if (parsed.error) return parsed.error;
      const { id, action, content } = parsed.data;
      if (action === "comment" && !content) {
        return NextResponse.json({ error: "Comment content required" }, { status: 400 });
      }
      let result: unknown;
      if (action === "like") result = await toggleLike(user, id);
      else if (action === "bookmark") result = await toggleBookmark(user, id);
      else result = await addComment(user, id, content || "");
      if (result && typeof result === "object" && "error" in result) {
        return NextResponse.json({ error: (result as { error: string }).error }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    const parsed = validate(updateSchema, body);
    if (parsed.error) return parsed.error;
    const result = await updateAnnouncement(user, parsed.data);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Announcements PATCH error:", error);
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
    if (!id) return NextResponse.json({ error: "Announcement id required" }, { status: 400 });
    const result = await deleteAnnouncement(user, id);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Announcements DELETE error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}