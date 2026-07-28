import { createServerClient } from "@/lib/supabase-server";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface Chunk {
  content: string;
  metadata: Record<string, unknown>;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) {
    // Return mock embedding for demo mode
    return new Array(768).fill(0).map(() => Math.random() - 0.5);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text }] },
        }),
      }
    );

    if (!response.ok) throw new Error(`Embedding API error: ${response.status}`);
    const data = await response.json();
    return data.embedding?.values || new Array(768).fill(0);
  } catch (error) {
    console.error("Embedding error:", error);
    return new Array(768).fill(0).map(() => Math.random() - 0.5);
  }
}

function splitIntoChunks(text: string, maxLength: number = 800): Chunk[] {
  const chunks: Chunk[] = [];
  const paragraphs = text.split(/\n\n+/);

  let currentChunk = "";
  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxLength && currentChunk) {
      chunks.push({ content: currentChunk.trim(), metadata: {} });
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    }
  }
  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), metadata: {} });
  }
  return chunks;
}

export async function indexPolicy(id: string) {
  const supabase = supabaseAdmin || (await createServerClient());
  if (!supabase) throw new Error("Database not configured");

  const { data: policy, error } = await supabase
    .from("company_policies")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !policy) throw error || new Error("Policy not found");

  // Delete existing chunks for this policy
  await supabase.from("policy_chunks").delete().eq("policy_id", id);

  const chunks = splitIntoChunks(policy.content);
  const embeddings = await Promise.all(
    chunks.map((c) => generateEmbedding(c.content))
  );

  const rows = chunks.map((chunk, i) => ({
    company_id: policy.company_id,
    policy_id: id,
    content: chunk.content,
    embedding: embeddings[i],
    metadata: { chunk_index: i, total_chunks: chunks.length, title: policy.title },
  }));

  const { error: insertError } = await supabase
    .from("policy_chunks")
    .insert(rows);

  if (insertError) throw insertError;
}

async function downloadFile(bucket: string, filePath: string): Promise<string> {
  const supabase = supabaseAdmin || (await createServerClient());
  if (!supabase) throw new Error("Database not configured");

  const { data, error } = await supabase.storage.from(bucket).download(filePath);
  if (error) throw error;

  const text = await data.text();
  return text;
}

export async function indexDocument(documentId: string) {
  const supabase = supabaseAdmin || (await createServerClient());
  if (!supabase) throw new Error("Database not configured");

  const { data: doc, error } = await supabase
    .from("policy_documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (error || !doc) throw error || new Error("Document not found");

  // Extract text from the document stored in Supabase Storage
  let text = doc.title;
  if (doc.file_path) {
    try {
      const fileContent = await downloadFile("policy_docs", doc.file_path);
      text = fileContent;
    } catch (dlError) {
      console.error("Could not download document file, using title only:", dlError);
    }
  }

  const chunks = splitIntoChunks(text);
  const embeddings = await Promise.all(
    chunks.map((c) => generateEmbedding(c.content))
  );

  // Delete existing chunks for this document
  await supabase.from("policy_chunks").delete().eq("document_id", doc.id);

  const rows = chunks.map((chunk, i) => ({
    company_id: doc.company_id,
    document_id: doc.id,
    content: chunk.content,
    embedding: embeddings[i],
    metadata: { chunk_index: i, total_chunks: chunks.length, document_title: doc.title, source: doc.file_path },
  }));

  const { error: insertError } = await supabase
    .from("policy_chunks")
    .insert(rows);

  if (insertError) throw insertError;
}

export async function queryCompanyKnowledge(
  query: string,
  companyId: string,
  topK: number = 5
) {
  if (!isSupabaseConfigured) return [];

  const supabase = await createServerClient();
  if (!supabase) return [];

  const embedding = await generateEmbedding(query);

  // Search via cosine similarity
  const { data, error } = await supabase.rpc("match_policy_chunks", {
    query_embedding: embedding,
    match_count: topK,
    p_company_id: companyId,
  });

  if (error) {
    // Fallback: text search if vector search fails
    console.error("Vector search error, falling back to text search:", error);
    const { data: textData } = await supabase
      .from("policy_chunks")
      .select("content, metadata, policy_id, document_id")
      .eq("company_id", companyId)
      .textSearch("content", query, { type: "websearch" })
      .limit(topK);

    return textData || [];
  }

  return data || [];
}

export async function getCompanyKnowledgeContext(
  query: string,
  companyId: string
): Promise<{ context: string; sources: { title: string; content: string }[] }> {
  const chunks = await queryCompanyKnowledge(query, companyId);

  if (chunks.length === 0) {
    return { context: "", sources: [] };
  }

  const seenContents = new Set<string>();
  const uniqueChunks: { content?: string; metadata?: Record<string, unknown>; similarity?: number }[] = [];

  for (const chunk of chunks) {
    const key = (chunk as { content?: string }).content?.substring(0, 100);
    if (!seenContents.has(key || "")) {
      seenContents.add(key || "");
      uniqueChunks.push(chunk as { content?: string; metadata?: Record<string, unknown>; similarity?: number });
    }
  }

  const context = uniqueChunks
    .map((c) => c.content)
    .filter(Boolean)
    .join("\n\n---\n\n");

  const sources = uniqueChunks.map((c) => ({
    title: (c.metadata?.title as string) || (c.metadata?.document_title as string) || "Policy Document",
    content: c.content?.substring(0, 200) || "",
    section: c.metadata?.chunk_index !== undefined ? `Section ${(c.metadata.chunk_index as number) + 1}` : "",
    source: (c.metadata?.source as string) || "",
    similarity: c.similarity ? Math.round((1 - c.similarity) * 100) : undefined,
  }));

  return { context, sources };
}
