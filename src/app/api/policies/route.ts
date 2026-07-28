import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireAuth } from "@/lib/services/auth";
import { createPolicy, updatePolicy, deletePolicy, getPolicyById } from "@/lib/services/policies";
import { createPolicySchema, updatePolicySchema, validate } from "@/lib/validation";
import { indexPolicy } from "@/lib/services/rag";

export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json([]);
    }

    const user = await requireAuth();
    const supabase = await createServerClient();
    if (!supabase) return NextResponse.json([]);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const policy = await getPolicyById(id);
      return NextResponse.json(policy);
    }

    const { data, error } = await supabase
      .from("company_policies")
      .select("id, title, category, created_at")
      .eq("company_id", user.company_id)
      .order("title", { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    console.error("Policies GET error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    if (user.role !== "admin" && user.role !== "hr") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { data: parsed, error: validationError } = validate(createPolicySchema, body);
    if (validationError) return validationError;

    const policy = await createPolicy(parsed);

    // Auto-index policy for RAG (non-blocking)
    indexPolicy(policy.id).catch(err =>
      console.error("Policy indexing failed (non-blocking):", err)
    );

    return NextResponse.json(policy, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    console.error("Policies POST error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    if (user.role !== "admin" && user.role !== "hr") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: "Policy ID is required" }, { status: 400 });
    }

    const { data: parsed, error: validationError } = validate(updatePolicySchema, updates);
    if (validationError) return validationError;

    const policy = await updatePolicy(id, parsed);

    // Re-index on content or title change
    if (parsed.content || parsed.title) {
      indexPolicy(policy.id).catch(err =>
        console.error("Policy re-indexing failed (non-blocking):", err)
      );
    }

    return NextResponse.json(policy);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    console.error("Policies PATCH error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
    }

    const user = await requireAuth();
    if (user.role !== "admin" && user.role !== "hr") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Policy ID is required" }, { status: 400 });
    }

    await deletePolicy(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    console.error("Policies DELETE error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
