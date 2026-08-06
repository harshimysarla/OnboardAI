import { Types } from "mongoose";

function toId(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === "string") return value;
  return String(value);
}

function toDate(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value as string);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

/**
 * Serializes a Mongoose document (lean or hydrated) into the API shape
 * the frontend expects: string `id`, snake_case fields, ISO dates.
 */
export function serializeDoc<T = Record<string, unknown>>(doc: Record<string, unknown> | null | undefined): T {
  if (!doc) return null as T;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === "_id" || key === "__v") continue;
    out[key] = value;
  }
  out.id = toId((doc as { _id?: unknown })._id);
  out.created_at = out.created_at || toDate((doc as { created_at?: unknown }).created_at);
  if (doc.updated_at) out.updated_at = toDate(doc.updated_at);
  return out as T;
}

export function serializeMany<T = Record<string, unknown>>(docs: Record<string, unknown>[] | null | undefined): T[] {
  if (!docs) return [];
  return docs.map((d) => serializeDoc<T>(d));
}

export { toId, toDate };
