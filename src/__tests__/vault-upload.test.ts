import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_MESSAGE,
  UNSUPPORTED_TYPE_MESSAGE,
  ALLOWED_EXTENSIONS,
  ACCEPT_ATTRIBUTE,
  prepareFileUpload,
  sanitizeFilename,
  getFileExtension,
  formatFileSize,
} from "@/lib/vault-upload";
import { uploadFileToVault } from "@/lib/vault-upload-client";

const mockState = vi.hoisted(() => ({ err: null as Error | null }));

vi.mock("cloudinary", async () => {
  const { PassThrough } = await import("node:stream");
  return {
    v2: {
      config: vi.fn(),
      uploader: {
        upload_stream: vi.fn(
          (_opts: unknown, cb: (error: Error | null, result?: { secure_url: string }) => void) => {
            const stream = new PassThrough();
            stream.on("finish", () => cb(mockState.err, mockState.err ? undefined : { secure_url: "https://res.cloudinary.com/x/y" }));
            return stream;
          }
        ),
      },
    },
  };
});

import { uploadToCloudinary, computeFileHash } from "@/lib/services/cloudinary";

const VALID_FILE = { name: "handbook.pdf", size: 51200, mimeType: "application/pdf", hash: "abc123" };

describe("vault upload validation", () => {
  it("allows every required file extension", () => {
    const required = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "png", "jpg", "jpeg", "svg", "webp"];
    for (const ext of required) {
      expect(ALLOWED_EXTENSIONS).toContain(ext);
    }
    expect(ACCEPT_ATTRIBUTE).toBe(".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.png,.jpg,.jpeg,.svg,.webp");
  });

  it("accepts a valid upload", () => {
    const result = prepareFileUpload(VALID_FILE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sanitizedName).toBe("handbook.pdf");
      expect(result.extension).toBe("pdf");
      expect(result.hash).toBe("abc123");
    }
  });

  it("accepts a file of exactly 1 MB", () => {
    const result = prepareFileUpload({ ...VALID_FILE, size: MAX_FILE_SIZE });
    expect(result.ok).toBe(true);
  });

  it("rejects files larger than 1 MB with the friendly message", () => {
    const result = prepareFileUpload({ ...VALID_FILE, size: MAX_FILE_SIZE + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(MAX_FILE_SIZE_MESSAGE);
    }
  });

  it("rejects unsupported extensions (executables included)", () => {
    for (const name of ["virus.exe", "run.sh", "script.js", "payload.bat", "noext", "archive.7z"]) {
      const result = prepareFileUpload({ ...VALID_FILE, name });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(400);
        expect(result.error).toBe(UNSUPPORTED_TYPE_MESSAGE);
      }
    }
  });

  it("rejects a mime type that does not match the extension", () => {
    const result = prepareFileUpload({ ...VALID_FILE, mimeType: "text/plain" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain("File type mismatch");
    }
  });

  it("accepts a file with no mime type when the extension is allowed", () => {
    const result = prepareFileUpload({ ...VALID_FILE, mimeType: "" });
    expect(result.ok).toBe(true);
  });

  it("rejects a duplicate upload with 409 and the existing document title", () => {
    const result = prepareFileUpload({ ...VALID_FILE, hash: "samehash" }, { docTitle: "Employee Handbook", versionFileName: "handbook.pdf" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toBe('This file already exists in the vault ("Employee Handbook").');
    }
  });

  it("requires a content hash (integrity check)", () => {
    const result = prepareFileUpload({ name: "a.pdf", size: 100, mimeType: "application/pdf" });
    expect(result.ok).toBe(false);
  });
});

describe("sanitizeFilename", () => {
  it("strips path components (Windows and POSIX)", () => {
    expect(sanitizeFilename("C:\\fakepath\\my file.pdf")).toBe("my file.pdf");
    expect(sanitizeFilename("/home/user/docs/plan.docx")).toBe("plan.docx");
  });

  it("replaces illegal characters and strips leading dots", () => {
    expect(sanitizeFilename('a<b>c?d"e.txt')).toBe("a_b_c_d_e.txt");
    expect(sanitizeFilename("..hidden.png")).toBe("hidden.png");
  });

  it("truncates over-long names but keeps the extension", () => {
    const long = `${"a".repeat(150)}.pdf`;
    const out = sanitizeFilename(long);
    expect(out.endsWith(".pdf")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(84);
  });

  it("falls back to a safe default", () => {
    expect(sanitizeFilename("")).toBe("document");
    expect(sanitizeFilename("....")).toBe("document");
  });
});

describe("helpers", () => {
  it("extracts lowercase extensions", () => {
    expect(getFileExtension("Report.PDF")).toBe("pdf");
    expect(getFileExtension("noext")).toBe("");
    expect(getFileExtension("trailing.")).toBe("");
  });

  it("formats file sizes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(MAX_FILE_SIZE)).toBe("1.00 MB");
  });

  it("computes a stable sha256 hash", () => {
    const a = computeFileHash(Buffer.from("onboarding"));
    const b = computeFileHash(Buffer.from("onboarding"));
    const c = computeFileHash(Buffer.from("onboarding!"));
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(a).not.toBe(c);
  });
});

describe("uploadFileToVault (client uploader)", () => {
  interface FakeXhr {
    status: number;
    responseText: string;
    opened: string;
    sent: unknown;
    aborted: boolean;
    upload: { onprogress: ((e: ProgressEvent) => void) | null };
    onload: (() => void) | null;
    onerror: (() => void) | null;
    onabort: (() => void) | null;
    open: (method: string, url: string) => void;
    send: (data: unknown) => void;
    abort: () => void;
  }

  function makeFakeXhr(): FakeXhr {
    const xhr: FakeXhr = {
      status: 0,
      responseText: "",
      opened: "",
      sent: null,
      aborted: false,
      upload: { onprogress: null },
      onload: null,
      onerror: null,
      onabort: null,
      open: (method: string, url: string) => {
        xhr.opened = `${method} ${url}`;
      },
      send: (data: unknown) => {
        xhr.sent = data;
      },
      abort: () => {
        xhr.aborted = true;
        xhr.onabort?.();
      },
    };
    return xhr;
  }

  it("posts FormData to the vault upload endpoint and reports progress", async () => {
    const xhr = makeFakeXhr();
    const fd = new FormData();
    fd.append("file", new File(["x"], "doc.pdf", { type: "application/pdf" }));
    const onProgress = vi.fn();
    const handle = uploadFileToVault(fd, onProgress, () => xhr);

    expect(xhr.opened).toBe("POST /api/vault/upload");
    expect(xhr.sent).toBe(fd);

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent);
    expect(onProgress).toHaveBeenCalledWith(50);

    xhr.status = 201;
    xhr.responseText = JSON.stringify({ ok: true });
    xhr.onload?.();
    await expect(handle.promise).resolves.toEqual({ ok: true });
  });

  it("surfaces server validation errors", async () => {
    const xhr = makeFakeXhr();
    const handle = uploadFileToVault(new FormData(), undefined, () => xhr);
    xhr.status = 400;
    xhr.responseText = JSON.stringify({ error: MAX_FILE_SIZE_MESSAGE });
    xhr.onload?.();
    await expect(handle.promise).resolves.toEqual({ ok: false, error: MAX_FILE_SIZE_MESSAGE });
  });

  it("surfaces duplicate-upload conflicts (409)", async () => {
    const xhr = makeFakeXhr();
    const handle = uploadFileToVault(new FormData(), undefined, () => xhr);
    xhr.status = 409;
    xhr.responseText = JSON.stringify({ error: 'This file already exists in the vault ("Handbook").' });
    xhr.onload?.();
    await expect(handle.promise).resolves.toEqual({ ok: false, error: 'This file already exists in the vault ("Handbook").' });
  });

  it("cancels the upload and resolves with a cancellation message", async () => {
    const xhr = makeFakeXhr();
    const handle = uploadFileToVault(new FormData(), undefined, () => xhr);
    handle.abort();
    expect(xhr.aborted).toBe(true);
    await expect(handle.promise).resolves.toEqual({ ok: false, error: "Upload cancelled" });
  });

  it("resolves a failure when the network request errors", async () => {
    const xhr = makeFakeXhr();
    const handle = uploadFileToVault(new FormData(), undefined, () => xhr);
    xhr.onerror?.();
    await expect(handle.promise).resolves.toEqual({ ok: false, error: "Upload failed. Please check your connection and try again." });
  });
});

describe("uploadToCloudinary", () => {
  beforeEach(() => {
    mockState.err = null;
  });

  it("resolves the secure URL when Cloudinary accepts the upload", async () => {
    await expect(uploadToCloudinary(Buffer.from("payload"), "onboardai/x", "1_doc.pdf")).resolves.toBe(
      "https://res.cloudinary.com/x/y"
    );
  });

  it("rejects when Cloudinary fails", async () => {
    mockState.err = new Error("Cloudinary API error: quota exceeded");
    await expect(uploadToCloudinary(Buffer.from("payload"), "onboardai/x", "1_doc.pdf")).rejects.toThrow(
      "Cloudinary API error: quota exceeded"
    );
  });
});
