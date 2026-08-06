import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isDatabaseConfigured, isCloudinaryConfigured } from "@/lib/env";
import { requireAuth } from "@/lib/services/auth";
import {
  createVaultDocumentFromFile,
  addFileVersion,
  UploadValidationError,
} from "@/lib/services/documents";
import { validate } from "@/lib/validation";

const categorySchema = z.enum(["policy", "contract", "onboarding", "legal", "hr", "training", "other"]);

const createSchema = z.object({
  title: z.string().min(1, "Document title is required"),
  category: categorySchema.optional().default("other"),
  description: z.string().optional(),
  notes: z.string().optional(),
});

const versionSchema = z.object({
  documentId: z.string().min(1, "Document id required"),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }
    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 });
    }

    const user = await requireAuth();
    if (user.role !== "admin" && user.role !== "hr") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }

    const raw = {
      title: (formData.get("title") as string | null) || undefined,
      category: (formData.get("category") as string | null) || undefined,
      description: (formData.get("description") as string | null) || undefined,
      notes: (formData.get("notes") as string | null) || undefined,
      documentId: (formData.get("documentId") as string | null) || undefined,
    };

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadFile = { name: file.name, size: file.size, mimeType: file.type, buffer };

    if (raw.documentId) {
      const parsed = validate(versionSchema, raw);
      if (parsed.error) return parsed.error;
      const result = await addFileVersion(user, {
        id: parsed.data.documentId,
        notes: parsed.data.notes,
        file: uploadFile,
      });
      if (result && typeof result === "object" && "error" in result) {
        return NextResponse.json({ error: (result as { error: string }).error }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    const parsed = validate(createSchema, raw);
    if (parsed.error) return parsed.error;
    const result = await createVaultDocumentFromFile(user, {
      title: parsed.data.title,
      category: parsed.data.category,
      description: parsed.data.description,
      notes: parsed.data.notes,
      file: uploadFile,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : "Upload failed";
    if (msg === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Insufficient permissions") return NextResponse.json({ error: msg }, { status: 403 });
    console.error("Vault upload error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
