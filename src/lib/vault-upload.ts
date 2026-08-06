// Shared validation/security rules for the Document Vault file upload workflow.
// Pure module: safe to import from both server and client code.

export const MAX_FILE_SIZE = 1024 * 1024; // 1 MB
export const MAX_FILE_SIZE_MESSAGE = "Maximum file size allowed is 1 MB.";
export const UNSUPPORTED_TYPE_MESSAGE =
  "Unsupported file type. Allowed: pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv, zip, png, jpg, jpeg, svg, webp.";

export const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
  "zip",
  "png",
  "jpg",
  "jpeg",
  "svg",
  "webp",
] as const;

export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",");

const EXT_TO_MIME: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/csv", "text/plain"],
  zip: ["application/zip", "application/x-zip-compressed"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  svg: ["image/svg+xml"],
  webp: ["image/webp"],
};

export function getFileExtension(name: string): string {
  const base = String(name || "").replace(/\\/g, "/").split("/").pop() || "";
  const idx = base.lastIndexOf(".");
  if (idx <= 0 || idx === base.length - 1) return "";
  return base.slice(idx + 1).toLowerCase();
}

export function sanitizeFilename(name: string): string {
  let base = String(name || "").replace(/\\/g, "/").split("/").pop() || "";
  base = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .trim()
    .replace(/^\.+/, "");
  if (!base) return "document";

  const ext = getFileExtension(base);
  const stem = ext ? base.slice(0, base.length - ext.length - 1) : base;
  const clipped = stem.length > 80 ? stem.slice(0, 80) : stem;
  return ext ? `${clipped}.${ext}` : clipped;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface UploadFileInfo {
  name: string;
  size: number;
  mimeType?: string;
  hash?: string;
}

export interface ExistingDuplicate {
  docTitle: string;
  versionFileName: string;
}

export type PreparedUpload =
  | { ok: true; sanitizedName: string; extension: string; mimeType: string; hash: string; size: number }
  | { ok: false; error: string; status: number };

export function prepareFileUpload(file: UploadFileInfo, existing?: ExistingDuplicate | null): PreparedUpload {
  const ext = getFileExtension(file.name);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return { ok: false, error: UNSUPPORTED_TYPE_MESSAGE, status: 400 };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: MAX_FILE_SIZE_MESSAGE, status: 400 };
  }
  if (file.mimeType && file.mimeType.trim()) {
    const mime = file.mimeType.split(";")[0].trim().toLowerCase();
    const allowed = EXT_TO_MIME[ext] || [];
    if (!allowed.includes(mime)) {
      return { ok: false, error: `File type mismatch: "${file.mimeType}" is not allowed for .${ext} files.`, status: 400 };
    }
  }
  if (!file.hash) {
    return { ok: false, error: "Unable to verify file integrity.", status: 400 };
  }
  if (existing) {
    return { ok: false, error: `This file already exists in the vault ("${existing.docTitle}").`, status: 409 };
  }
  return {
    ok: true,
    sanitizedName: sanitizeFilename(file.name),
    extension: ext,
    mimeType: file.mimeType || "",
    hash: file.hash,
    size: file.size,
  };
}
