import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isDatabaseConfigured } from "@/lib/env";
import { requireAuth } from "@/lib/services/auth";
import { listAssets, createAsset, updateAsset, deleteAsset } from "@/lib/services/assets";
import { validate } from "@/lib/validation";

const createSchema = z.object({
  name: z.string().min(1, "Asset name is required"),
  type: z.enum(["laptop", "monitor", "phone", "peripheral", "software", "other"]).optional().default("other"),
  serial_number: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  type: z.enum(["laptop", "monitor", "phone", "peripheral", "software", "other"]).optional(),
  serial_number: z.string().optional(),
  status: z.enum(["available", "assigned", "maintenance", "retired"]).optional(),
  notes: z.string().optional(),
  assigned_to: z.string().optional(),
});

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }
    const user = await requireAuth();
    const data = await listAssets(user);
    return NextResponse.json(data || { assets: [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Assets GET error:", error);
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
    return NextResponse.json(await createAsset(user, parsed.data), { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Insufficient permissions") return NextResponse.json({ error: msg }, { status: 403 });
    console.error("Assets create error:", error);
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
    const result = await updateAsset(user, parsed.data);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Insufficient permissions") return NextResponse.json({ error: msg }, { status: 403 });
    console.error("Assets update error:", error);
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
    if (!id) return NextResponse.json({ error: "Asset id required" }, { status: 400 });
    const result = await deleteAsset(user, id);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Insufficient permissions") return NextResponse.json({ error: msg }, { status: 403 });
    console.error("Assets delete error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}