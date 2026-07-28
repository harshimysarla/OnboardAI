import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireAuth } from "@/lib/services/auth";
import { indexPolicy } from "@/lib/services/rag";
import { documentUploadSchema, validate } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
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

    const supabase = await createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    // Upload to Supabase Storage
    const filePath = `${user.company_id}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("policy_docs")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Create document record
    const { data: doc, error: docError } = await supabase
      .from("policy_documents")
      .insert({
        company_id: user.company_id,
        title,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (docError) throw docError;

    // Index document for RAG
    await indexPolicy(doc.id);

    return NextResponse.json(doc, { status: 201 });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json([]);
    }

    const user = await requireAuth();
    const supabase = await createServerClient();
    if (!supabase) return NextResponse.json([]);

    const { data, error } = await supabase
      .from("policy_documents")
      .select("*")
      .eq("company_id", user.company_id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Documents error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
