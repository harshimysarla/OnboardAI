import { connectDB } from "@/lib/db";
import { Policy, PolicyChunk, PolicyDocument } from "@/lib/models";
import { toId } from "@/lib/serialize";
import { getEnvVars } from "@/lib/env";
import { Types } from "mongoose";

interface Chunk {
  content: string;
  metadata: Record<string, unknown>;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const geminiApiKey = getEnvVars().geminiApiKey;
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Cannot generate embeddings.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
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
}

export function splitIntoChunks(text: string, maxLength: number = 800): Chunk[] {
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
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const policy = await Policy.findById(id).lean();
  if (!policy) throw new Error("Policy not found");

  await PolicyChunk.deleteMany({ policy_id: id });

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

  await PolicyChunk.insertMany(rows);
}

export async function indexDocument(documentId: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const doc = await PolicyDocument.findById(documentId).lean();
  if (!doc) throw new Error("Document not found");

  let text = doc.title;
  const fileType = doc.file_type || "";
  const isTextFile =
    fileType.startsWith("text/") ||
    fileType.includes("json") ||
    fileType.includes("xml") ||
    /\.(txt|md|markdown|csv|json|xml|html?)$/i.test(doc.file_url || "");

  if (doc.file_url && isTextFile) {
    try {
      const response = await fetch(doc.file_url);
      if (response.ok) {
        text = await response.text();
      }
    } catch (dlError) {
      console.error("Could not download document file, using title only:", dlError);
    }
  }

  const chunks = splitIntoChunks(text);
  const embeddings = await Promise.all(
    chunks.map((c) => generateEmbedding(c.content))
  );

  await PolicyChunk.deleteMany({ document_id: documentId });

  const rows = chunks.map((chunk, i) => ({
    company_id: doc.company_id,
    document_id: documentId,
    content: chunk.content,
    embedding: embeddings[i],
    metadata: {
      chunk_index: i,
      total_chunks: chunks.length,
      document_title: doc.title,
      source: doc.file_url,
    },
  }));

  await PolicyChunk.insertMany(rows);
}

export async function queryCompanyKnowledge(
  query: string,
  companyId: string,
  topK: number = 5
) {
  const conn = await connectDB();
  if (!conn) return [];

  let embedding: number[];
  try {
    embedding = await generateEmbedding(query);
  } catch {
    return await textSearchFallback(query, companyId, topK);
  }

  // MongoDB Atlas Vector Search (requires an Atlas Vector Search index
  // on policychunks.embedding). Falls back to text search when unavailable.
  try {
    const companyFilter = Types.ObjectId.isValid(companyId)
      ? new Types.ObjectId(companyId)
      : companyId;

    const result = await PolicyChunk.aggregate([
      {
        $vectorSearch: {
          index: "policy_chunks_vector",
          path: "embedding",
          queryVector: embedding,
          numCandidates: 100,
          limit: topK,
          filter: { company_id: companyFilter },
        },
      },
      {
        $project: {
          content: 1,
          metadata: 1,
          policy_id: 1,
          document_id: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);

    if (result.length > 0) {
      return result.map((r) => ({
        content: r.content,
        metadata: r.metadata,
        policy_id: toId(r.policy_id),
        document_id: toId(r.document_id),
        similarity: r.score,
      }));
    }
  } catch (err) {
    console.error("Vector search error, falling back to text search:", err);
  }

  return await textSearchFallback(query, companyId, topK);
}

async function textSearchFallback(query: string, companyId: string, topK: number) {
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const chunks = await PolicyChunk.find({ company_id: companyId, content: regex })
    .limit(topK)
    .lean();

  return chunks.map((c) => ({
    content: c.content,
    metadata: c.metadata,
    policy_id: toId(c.policy_id),
    document_id: toId(c.document_id),
  }));
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
  const uniqueChunks: {
    content?: string;
    metadata?: Record<string, unknown>;
    similarity?: number;
  }[] = [];

  for (const chunk of chunks) {
    const key = (chunk as { content?: string }).content?.substring(0, 100);
    if (!seenContents.has(key || "")) {
      seenContents.add(key || "");
      uniqueChunks.push(
        chunk as { content?: string; metadata?: Record<string, unknown>; similarity?: number }
      );
    }
  }

  const context = uniqueChunks
    .map((c) => c.content)
    .filter(Boolean)
    .join("\n\n---\n\n");

  const sources = uniqueChunks.map((c) => ({
    title:
      (c.metadata?.title as string) ||
      (c.metadata?.document_title as string) ||
      "Policy Document",
    content: c.content?.substring(0, 200) || "",
    section:
      c.metadata?.chunk_index !== undefined
        ? `Section ${(c.metadata.chunk_index as number) + 1}`
        : "",
    source: (c.metadata?.source as string) || "",
    similarity:
      c.similarity !== undefined
        ? Math.round((1 - c.similarity) * 100)
        : undefined,
  }));

  return { context, sources };
}
