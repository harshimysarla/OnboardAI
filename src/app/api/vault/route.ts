import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isDatabaseConfigured } from "@/lib/env";
import { requireAuth } from "@/lib/services/auth";
import {
  listVaultDocuments,
  createVaultDocument,
  addDocumentVersion,
  updateVaultDocument,
  deleteVaultDocument,
} from "@/lib/services/documents";
import { validate } from "@/lib/validation";

const categorySchema = z.enum(["policy", "contract", "onboarding", "legal", "hr", "training", "other"]);

const createSchema = z.object({
  title: z.string().min(1, "Document title is required"),
  category: categorySchema.optional().default("other"),
  description: z.string().optional(),
  file_name: z.string().optional(),
  content: z.string().optional(),
  notes: z.string().optional(),
});

const versionSchema = z.object({
  id: z.string().min(1),
  file_name: z.string().optional(),
  content: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  category: categorySchema.optional(),
  description: z.string().optional(),
});

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }
    const user = await requireAuth();
    const data = await listVaultDocuments(user);
    return NextResponse.json(data || { documents: [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Vault GET error:", error);
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
    return NextResponse.json(await createVaultDocument(user, parsed.data), { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Insufficient permissions") return NextResponse.json({ error: msg }, { status: 403 });
    console.error("Vault create error:", error);
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

    if (body && body.action === "version") {
      const parsed = validate(versionSchema, { ...body, id: body.id });
      if (parsed.error) return parsed.error;
      const result = await addDocumentVersion(user, parsed.data);
      if (result && typeof result === "object" && "error" in result) {
        return NextResponse.json({ error: (result as { error: string }).error }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    const parsed = validate(updateSchema, body);
    if (parsed.error) return parsed.error;
    const result = await updateVaultDocument(user, parsed.data);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Insufficient permissions") return NextResponse.json({ error: msg }, { status: 403 });
    console.error("Vault update error:", error);
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
    if (!id) return NextResponse.json({ error: "Document id required" }, { status: 400 });
    const result = await deleteVaultDocument(user, id);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Insufficient permissions") return NextResponse.json({ error: msg }, { status: 403 });
    console.error("Vault delete error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}