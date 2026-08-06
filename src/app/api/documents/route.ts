import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured, isCloudinaryConfigured } from "@/lib/env";
import { connectDB } from "@/lib/db";
import { PolicyDocument } from "@/lib/models";
import { requireAuth } from "@/lib/services/auth";
import { indexDocument } from "@/lib/services/rag";
import { uploadToCloudinary } from "@/lib/services/cloudinary";
import { documentUploadSchema, validate } from "@/lib/validation";
import { serializeDoc, serializeMany } from "@/lib/serialize";

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
    const file = formData.get("file") as File | null;
    const titleRaw = (formData.get("title") as string) || file?.name || "Untitled";

    if (!file) {
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }

    const { data: parsed, error: validationError } = validate(documentUploadSchema, { title: titleRaw });
    if (validationError) return validationError;
    const title = parsed.title;

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeStem = file.name.replace(/[^\w.\-]/g, "_").replace(/\.[^.]+$/, "");
    const fileUrl = await uploadToCloudinary(
      buffer,
      `onboardai/${user.company_id}`,
      `${Date.now()}_${safeStem}`,
      "raw"
    );

    const conn = await connectDB();
    if (!conn) throw new Error("Database not configured");

    const doc = await PolicyDocument.create({
      company_id: user.company_id,
      uploaded_by: user.id,
      title,
      file_url: fileUrl,
      file_type: file.type,
      file_size: file.size,
    });

    // Index document for RAG (non-blocking)
    indexDocument(doc._id.toString()).catch((err) =>
      console.error("Document indexing failed (non-blocking):", err)
    );

    return NextResponse.json(serializeDoc(doc.toObject()), { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Upload failed";
    console.error("Upload error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json([]);
    }

    const user = await requireAuth();
    const conn = await connectDB();
    if (!conn) return NextResponse.json([]);

    const docs = await PolicyDocument.find({ company_id: user.company_id })
      .sort({ created_at: -1 })
      .lean();

    return NextResponse.json(serializeMany(docs));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    console.error("Documents error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}