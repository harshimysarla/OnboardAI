"use client";

import { useRef, useState } from "react";
import {
  FileArchive,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  UploadCloud,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_MESSAGE,
  UNSUPPORTED_TYPE_MESSAGE,
  formatFileSize,
  getFileExtension,
} from "@/lib/vault-upload";
import { uploadFileToVault } from "@/lib/vault-upload-client";

const CATEGORY_OPTIONS = [
  { value: "policy", label: "Policy" },
  { value: "contract", label: "Contract" },
  { value: "onboarding", label: "Onboarding" },
  { value: "legal", label: "Legal" },
  { value: "hr", label: "HR" },
  { value: "training", label: "Training" },
  { value: "other", label: "Other" },
];

const TYPE_ICON: Record<string, LucideIcon> = {
  png: ImageIcon,
  jpg: ImageIcon,
  jpeg: ImageIcon,
  webp: ImageIcon,
  svg: ImageIcon,
  zip: FileArchive,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
};

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "svg"];

function clientValidateFile(file: File): string | null {
  const ext = getFileExtension(file.name);
  if (!ACCEPT_ATTRIBUTE.split(",").map((e) => e.slice(1)).includes(ext)) {
    return UNSUPPORTED_TYPE_MESSAGE;
  }
  if (file.size > MAX_FILE_SIZE) return MAX_FILE_SIZE_MESSAGE;
  return null;
}

function titleFromFile(file: File): string {
  return (file.name.replace(/\.[^.]+$/, "") || "Untitled").trim();
}

interface VaultUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
  documentId?: string;
  initialFile?: File | null;
}

export function VaultUploadModal({ open, onClose, onUploaded, documentId, initialFile }: VaultUploadModalProps) {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [title, setTitle] = useState(initialFile ? titleFromFile(initialFile) : "");
  const [category, setCategory] = useState("policy");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => {
    if (!initialFile) return null;
    const ext = getFileExtension(initialFile.name);
    return IMAGE_EXTS.includes(ext) || ext === "pdf" ? URL.createObjectURL(initialFile) : null;
  });

  if (!open) return null;

  const ext = file ? getFileExtension(file.name) : "";
  const TypeIcon = file && TYPE_ICON[ext] ? TYPE_ICON[ext] : FileText;
  const showPreview = file && (IMAGE_EXTS.includes(ext) || ext === "pdf");

  const applyFile = (candidate: File) => {
    const err = clientValidateFile(candidate);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setProgress(0);
    setFile(candidate);
    if (!title.trim()) setTitle(titleFromFile(candidate));
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextExt = getFileExtension(candidate.name);
    setPreviewUrl(IMAGE_EXTS.includes(nextExt) || nextExt === "pdf" ? URL.createObjectURL(candidate) : null);
  };

  const close = () => {
    if (uploading && abortRef.current) abortRef.current();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose();
  };

  const startUpload = () => {
    if (!file || uploading) return;
    if (!documentId && !title.trim()) {
      setError("Document title is required");
      return;
    }
    setUploading(true);
    setError("");
    setProgress(0);

    const fd = new FormData();
    fd.append("file", file);
    if (!documentId) {
      fd.append("title", title.trim());
      fd.append("category", category);
      if (description.trim()) fd.append("description", description.trim());
    }
    if (notes.trim()) fd.append("notes", notes.trim());
    if (documentId) fd.append("documentId", documentId);

    const handle = uploadFileToVault(fd, (pct) => setProgress(pct));
    abortRef.current = () => {
      handle.abort();
      abortRef.current = null;
    };

    handle.promise.then((result) => {
      abortRef.current = null;
      setUploading(false);
      if (!result.ok) {
        setError(result.error || "Upload failed");
        setProgress(0);
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      onUploaded();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {documentId ? "Upload New Version" : "Upload Document"}
          </h2>
          <button onClick={close} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!file ? (
          <div
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragActive ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:border-indigo-400"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) applyFile(dropped);
            }}
            onClick={() => inputRef.current?.click()}
          >
            <UploadCloud className="mb-3 h-10 w-10 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Drag &amp; drop a file here</p>
            <p className="mt-1 text-xs text-gray-400">or click to browse</p>
            <p className="mt-3 text-xs text-gray-400">{MAX_FILE_SIZE_MESSAGE} Supported: PDF, Word, Excel, PowerPoint, TXT, CSV, ZIP, PNG, JPG, SVG, WEBP.</p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) applyFile(picked);
                e.target.value = "";
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-lg bg-gray-50 p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                <TypeIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(file.size)} · {file.type || `${ext.toUpperCase()} file`}
                </p>
              </div>
            </div>

            {showPreview && previewUrl && (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                {IMAGE_EXTS.includes(ext) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt={file.name} className="max-h-48 w-full object-contain" />
                ) : (
                  <iframe title={`${file.name} preview`} src={previewUrl} className="h-56 w-full" />
                )}
              </div>
            )}

            {!documentId && (
              <>
                <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Employee Handbook" />
                <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={CATEGORY_OPTIONS} />
                <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </>
            )}
            <Input label="Version notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={documentId ? "What changed in this version?" : "Initial version"} />

            {uploading && (
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                  <span>Uploading…</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={close}>
                {uploading ? "Cancel Upload" : "Cancel"}
              </Button>
              <Button onClick={startUpload} disabled={uploading}>
                {uploading ? `Uploading ${progress}%…` : "Upload"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
