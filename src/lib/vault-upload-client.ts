// Client-side uploader for the Document Vault.
// Uses XMLHttpRequest so upload progress is reportable and cancellable.
// The xhr factory is injectable for tests.

export interface VaultUploadResult {
  ok: boolean;
  error?: string;
}

export interface UploadHandle {
  promise: Promise<VaultUploadResult>;
  abort: () => void;
}

export interface XhrLike {
  open(method: string, url: string): void;
  send(body: FormData): void;
  abort(): void;
  upload: { onprogress: ((e: ProgressEvent) => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  status: number;
  responseText: string;
}

export function uploadFileToVault(
  formData: FormData,
  onProgress?: (percent: number) => void,
  xhrFactory?: () => XhrLike
): UploadHandle {
  const xhr = (xhrFactory || (() => new XMLHttpRequest()))();

  const promise = new Promise<VaultUploadResult>((resolve) => {
    xhr.open("POST", "/api/vault/upload");
    xhr.upload.onprogress = (e: ProgressEvent) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      let data: { error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true });
      } else {
        resolve({ ok: false, error: data.error || `Upload failed (HTTP ${xhr.status})` });
      }
    };
    xhr.onerror = () => resolve({ ok: false, error: "Upload failed. Please check your connection and try again." });
    xhr.onabort = () => resolve({ ok: false, error: "Upload cancelled" });
    xhr.send(formData);
  });

  return {
    promise,
    abort: () => xhr.abort(),
  };
}
