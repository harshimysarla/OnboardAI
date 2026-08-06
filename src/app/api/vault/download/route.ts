import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { requireAuth } from "@/lib/services/auth";
import { registerDownload } from "@/lib/services/documents";

export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Document id required" }, { status: 400 });

    const result = await registerDownload(user, id);
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 404 });
    }
    const { title, version_number, file_name, content, file_url, mime_type } = result as {
      title: string;
      version_number: number;
      file_name: string;
      content: string;
      file_url?: string;
      mime_type?: string;
    };

    const safeName = file_name.replace(/[^\w.\- ]/g, "_") || `document-v${version_number}.txt`;

    if (file_url) {
      const upstream = await fetch(file_url);
      if (!upstream.ok) throw new Error("Unable to fetch file from storage");
      const buf = Buffer.from(await upstream.arrayBuffer());
      return new NextResponse(buf, {
        headers: {
          "Content-Type": mime_type || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${safeName}"`,
        },
      });
    }

    const header = `Document: ${title}\nVersion: v${version_number}\nDownloaded: ${new Date().toISOString()}\n${"-".repeat(40)}\n\n`;
    return new NextResponse(header + content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Vault download error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}