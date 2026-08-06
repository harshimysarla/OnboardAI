import { connectDB } from "@/lib/db";
import { VaultDocument } from "@/lib/models";
import { serializeDoc } from "@/lib/serialize";
import type { AuthenticatedUser } from "@/lib/services/auth";
import { computeFileHash, uploadToCloudinary } from "@/lib/services/cloudinary";
import { prepareFileUpload } from "@/lib/vault-upload";

type VaultUser = Pick<AuthenticatedUser, "id" | "company_id" | "role" | "full_name">;

export class UploadValidationError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "UploadValidationError";
    this.status = status;
  }
}

export type VaultUploader = (buffer: Buffer, folder: string, filename: string, resourceType?: "auto" | "image" | "raw") => Promise<string>;

export interface VaultFileInput {
  name: string;
  size: number;
  mimeType: string;
  buffer: Buffer;
}

function cloudinaryFileKey(prep: { sanitizedName: string }) {
  const stem = prep.sanitizedName.replace(/\.[^.]+$/, "");
  return `${Date.now()}_${stem}`;
}

function withCurrentVersion(doc: Record<string, unknown>) {
  const versions = (doc.versions as Record<string, unknown>[]) || [];
  const current = versions.find((v) => Number(v.version_number) === Number(doc.current_version)) || versions[versions.length - 1] || null;
  return {
    ...serializeDoc(doc),
    current: current
      ? {
          version_number: current.version_number,
          file_name: current.file_name,
          uploaded_by_name: current.uploaded_by_name,
          notes: current.notes,
          uploaded_at: current.uploaded_at,
          ...(current.file_url
            ? { file_url: current.file_url, file_size: current.file_size, mime_type: current.mime_type }
            : {}),
        }
      : null,
  };
}

export async function listVaultDocuments(user: VaultUser) {
  const conn = await connectDB();
  if (!conn) return null;
  const docs = await VaultDocument.find({ company_id: user.company_id }).sort({ updated_at: -1 }).lean();
  const rows = (docs as unknown[]).map((d) => withCurrentVersion(d as Record<string, unknown>));
  return { documents: rows };
}

export async function createVaultDocument(
  user: VaultUser,
  input: { title: string; category: string; description?: string; file_name?: string; content?: string; notes?: string }
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  if (user.role !== "admin" && user.role !== "hr") throw new Error("Insufficient permissions");

  const doc = await VaultDocument.create({
    company_id: user.company_id,
    title: input.title,
    category: input.category,
    description: input.description || "",
    versions: [{
      version_number: 1,
      file_name: input.file_name || `${input.title}.txt`,
      content: input.content || "",
      uploaded_by: user.id,
      uploaded_by_name: user.full_name,
      notes: input.notes || "",
      uploaded_at: new Date(),
    }],
    current_version: 1,
    download_count: 0,
  });
  return { document: withCurrentVersion(doc.toObject()) };
}

export async function addDocumentVersion(
  user: VaultUser,
  input: { id: string; file_name?: string; content?: string; notes?: string }
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  if (user.role !== "admin" && user.role !== "hr") throw new Error("Insufficient permissions");

  const doc = await VaultDocument.findOne({ _id: input.id, company_id: user.company_id });
  if (!doc) return { error: "Document not found" };

  const nextVersion = (doc.versions.length ? Math.max(...doc.versions.map((v: { version_number: number }) => v.version_number)) : 0) + 1;
  doc.versions.push({
    version_number: nextVersion,
    file_name: input.file_name || doc.title || `v${nextVersion}.txt`,
    content: input.content || "",
    uploaded_by: user.id,
    uploaded_by_name: user.full_name,
    notes: input.notes || "",
    uploaded_at: new Date(),
  } as never);
  doc.current_version = nextVersion;
  await doc.save();
  return { document: withCurrentVersion(doc.toObject()) };
}

export async function findDuplicateFile(companyId: string, hash: string) {
  const existing = await VaultDocument.findOne({ company_id: companyId, "versions.content_hash": hash }).lean();
  if (!existing) return null;
  const versions = (existing.versions as Record<string, unknown>[]) || [];
  const hit = versions.find((v) => v.content_hash === hash);
  return {
    docTitle: existing.title,
    versionFileName: (hit as { file_name?: string } | undefined)?.file_name || existing.title,
  };
}

async function validateAndPrepFile(user: VaultUser, file: VaultFileInput) {
  if (user.role !== "admin" && user.role !== "hr") throw new Error("Insufficient permissions");
  const hash = computeFileHash(file.buffer);
  const existing = await findDuplicateFile(user.company_id, hash);
  const prep = prepareFileUpload({ name: file.name, size: file.size, mimeType: file.mimeType, hash }, existing);
  if (!prep.ok) throw new UploadValidationError(prep.error, prep.status);
  return { hash, prep };
}

function fileVersionFields(file: VaultFileInput, hash: string, sanitizedName: string, fileUrl: string) {
  return {
    file_name: sanitizedName,
    file_url: fileUrl,
    file_size: file.size,
    mime_type: file.mimeType || "",
    content_hash: hash,
  };
}

export async function createVaultDocumentFromFile(
  user: VaultUser,
  input: {
    title: string;
    category: string;
    description?: string;
    notes?: string;
    file: VaultFileInput;
    uploader?: VaultUploader;
  }
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  const { prep } = await validateAndPrepFile(user, input.file);
  const uploader = input.uploader || uploadToCloudinary;
  const fileUrl = await uploader(input.file.buffer, `onboardai/${user.company_id}`, cloudinaryFileKey(prep), "raw");

  const doc = await VaultDocument.create({
    company_id: user.company_id,
    title: input.title,
    category: input.category,
    description: input.description || "",
    versions: [{
      version_number: 1,
      ...fileVersionFields(input.file, prep.hash, prep.sanitizedName, fileUrl),
      uploaded_by: user.id,
      uploaded_by_name: user.full_name,
      notes: input.notes || "",
      uploaded_at: new Date(),
    }],
    current_version: 1,
    download_count: 0,
  });
  return { document: withCurrentVersion(doc.toObject()) };
}

export async function addFileVersion(
  user: VaultUser,
  input: {
    id: string;
    notes?: string;
    file: VaultFileInput;
    uploader?: VaultUploader;
  }
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  const { prep } = await validateAndPrepFile(user, input.file);

  const doc = await VaultDocument.findOne({ _id: input.id, company_id: user.company_id });
  if (!doc) return { error: "Document not found" };

  const uploader = input.uploader || uploadToCloudinary;
  const fileUrl = await uploader(input.file.buffer, `onboardai/${user.company_id}`, cloudinaryFileKey(prep), "raw");

  const nextVersion = (doc.versions.length ? Math.max(...doc.versions.map((v: { version_number: number }) => v.version_number)) : 0) + 1;
  doc.versions.push({
    version_number: nextVersion,
    ...fileVersionFields(input.file, prep.hash, prep.sanitizedName, fileUrl),
    uploaded_by: user.id,
    uploaded_by_name: user.full_name,
    notes: input.notes || "",
    uploaded_at: new Date(),
  } as never);
  doc.current_version = nextVersion;
  await doc.save();
  return { document: withCurrentVersion(doc.toObject()) };
}

export async function updateVaultDocument(
  user: VaultUser,
  input: { id: string; title?: string; category?: string; description?: string }
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  if (user.role !== "admin" && user.role !== "hr") throw new Error("Insufficient permissions");

  const doc = await VaultDocument.findOne({ _id: input.id, company_id: user.company_id });
  if (!doc) return { error: "Document not found" };
  if (input.title !== undefined) doc.title = input.title;
  if (input.category !== undefined) doc.category = input.category as never;
  if (input.description !== undefined) doc.description = input.description;
  await doc.save();
  return { document: withCurrentVersion(doc.toObject()) };
}

export async function deleteVaultDocument(user: VaultUser, id: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  if (user.role !== "admin" && user.role !== "hr") throw new Error("Insufficient permissions");
  const doc = await VaultDocument.findOne({ _id: id, company_id: user.company_id });
  if (!doc) return { error: "Document not found" };
  await VaultDocument.deleteOne({ _id: doc._id });
  return { ok: true };
}

export async function registerDownload(user: VaultUser, id: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  const doc = await VaultDocument.findOne({ _id: id, company_id: user.company_id });
  if (!doc) return { error: "Document not found" };
  doc.download_count = (doc.download_count || 0) + 1;
  doc.last_downloaded_at = new Date();
  await doc.save();

  const versions = (doc.versions as Record<string, unknown>[]) || [];
  const current = versions.find((v) => Number(v.version_number) === Number(doc.current_version)) || versions[versions.length - 1];
  const currentFile = current as { file_name?: string; content?: string; file_url?: string; mime_type?: string } | undefined;
  return {
    ok: true,
    title: doc.title,
    version_number: doc.current_version,
    file_name: currentFile?.file_name || `${doc.title}.txt`,
    content: currentFile?.content || "",
    ...(currentFile?.file_url
      ? { file_url: currentFile.file_url, mime_type: currentFile.mime_type || "" }
      : {}),
  };
}