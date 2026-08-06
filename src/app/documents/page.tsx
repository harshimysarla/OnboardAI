"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { VaultUploadModal } from "@/components/vault/upload-modal";
import { formatDate } from "@/lib/utils";
import { useUser } from "@/lib/use-user";
import { ACCEPT_ATTRIBUTE, MAX_FILE_SIZE, MAX_FILE_SIZE_MESSAGE, UNSUPPORTED_TYPE_MESSAGE, formatFileSize, getFileExtension } from "@/lib/vault-upload";
import { FolderOpen, Download, History, Trash2, X, FileText, UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";

interface DocVersion {
  version_number: number;
  file_name: string;
  uploaded_by_name: string;
  notes: string;
  uploaded_at: string;
  file_url?: string;
  file_size?: number;
  mime_type?: string;
}

interface VaultDoc {
  id: string;
  title: string;
  category: string;
  description: string;
  download_count: number;
  last_downloaded_at?: string;
  versions?: DocVersion[];
  current?: {
    version_number: number;
    file_name: string;
    uploaded_by_name: string;
    notes: string;
    uploaded_at: string;
    file_url?: string;
    file_size?: number;
    mime_type?: string;
  } | null;
}

const CATEGORY_META: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  policy: { label: "Policy", variant: "info" },
  contract: { label: "Contract", variant: "default" },
  onboarding: { label: "Onboarding", variant: "success" },
  legal: { label: "Legal", variant: "danger" },
  hr: { label: "HR", variant: "warning" },
  training: { label: "Training", variant: "default" },
  other: { label: "Other", variant: "default" },
};

export default function VaultPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ title: "", category: "policy", description: "", file_name: "", content: "", notes: "" });
  const [versionForm, setVersionForm] = useState<Record<string, { content: string; notes: string }>>({});
  const [notice, setNotice] = useState<{ msg: string; kind: "success" | "error" } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDocId, setModalDocId] = useState<string | undefined>(undefined);
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [modalSeq, setModalSeq] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isStaff = user?.role === "admin" || user?.role === "hr";

  const showNotice = useCallback((msg: string, kind: "success" | "error" = "error") => {
    setNotice({ msg, kind });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const load = useCallback(async () => {
    const res = await fetch("/api/vault");
    if (!res.ok) return;
    const data = await res.json();
    setDocs(data.documents || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  const openFilePicker = (documentId?: string) => {
    setModalDocId(documentId);
    setModalSeq((s) => s + 1);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    const ext = getFileExtension(picked.name);
    if (!ACCEPT_ATTRIBUTE.split(",").map((x) => x.slice(1)).includes(ext)) {
      showNotice(UNSUPPORTED_TYPE_MESSAGE);
      return;
    }
    if (picked.size > MAX_FILE_SIZE) {
      showNotice(MAX_FILE_SIZE_MESSAGE);
      return;
    }
    setModalFile(picked);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalFile(null);
    setModalDocId(undefined);
  };

  const create = async () => {
    if (!form.title.trim()) {
      setMessage("Document title is required");
      return;
    }
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Unable to create document");
      return;
    }
    setForm({ title: "", category: "policy", description: "", file_name: "", content: "", notes: "" });
    setShowForm(false);
    load();
  };

  const addVersion = async (id: string, title: string) => {
    const vf = versionForm[id] || { content: "", notes: "" };
    if (!vf.content.trim()) {
      setMessage("Version content is required");
      return;
    }
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/vault", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "version", id, content: vf.content, notes: vf.notes, file_name: `${title}.txt` }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Unable to add version");
      return;
    }
    setVersionForm((prev) => ({ ...prev, [id]: { content: "", notes: "" } }));
    load();
  };

  const download = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/vault/download?id=${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || "Download failed");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const name = match ? match[1] : "document.txt";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    await fetch(`/api/vault?id=${id}`, { method: "DELETE" });
    setBusy(false);
    load();
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visible = docs.filter((d) => filter === "all" || d.category === filter);

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Vault</h1>
          <p className="mt-1 text-sm text-gray-500">Company documents and downloadable resources</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-40"
            options={[{ value: "all", label: "All categories" }, ...Object.entries(CATEGORY_META).map(([k, v]) => ({ value: k, label: v.label }))]} />
          {isStaff && (
            <>
              <input ref={fileInputRef} type="file" accept={ACCEPT_ATTRIBUTE} className="hidden" onChange={handleFilePicked} />
              <Button onClick={() => openFilePicker()}><UploadCloud className="mr-2 h-4 w-4" />Upload</Button>
              <Button variant="outline" onClick={() => setShowForm(!showForm)}><FileText className="mr-2 h-4 w-4" />Text Document</Button>
            </>
          )}
        </div>
      </div>

      {notice && (
        <p className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${notice.kind === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {notice.kind === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {notice.msg}
        </p>
      )}

      {message && <p className="mb-4 text-sm text-red-600">{message}</p>}

      {showForm && isStaff && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Upload Document</CardTitle>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Employee Handbook" />
              <div>
                <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  options={Object.entries(CATEGORY_META).map(([k, v]) => ({ value: k, label: v.label }))} />
              </div>
            </div>
            <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input label="File name" value={form.file_name} onChange={(e) => setForm({ ...form, file_name: e.target.value })} placeholder="handbook-v1.txt" />
            <div>
              <label className="block text-sm font-medium text-gray-700">Content</label>
              <textarea
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                rows={4}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Document content (text you can browse)"
              />
            </div>
            <Input label="Version notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Initial version" />
            <Button loading={busy} onClick={create}>Upload</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {visible.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon={<FolderOpen className="h-12 w-12" />} title="No documents" description="Documents uploaded by your team will appear here." />
          </CardContent></Card>
        ) : (
          visible.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-indigo-500" />
                    <h3 className="font-semibold text-gray-900">{d.title}</h3>
                    <Badge variant={CATEGORY_META[d.category]?.variant || "default"}>{CATEGORY_META[d.category]?.label || d.category}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.last_downloaded_at && <span className="text-xs text-gray-400">last download {formatDate(d.last_downloaded_at)}</span>}
                    <Button size="sm" variant="outline" loading={busy} onClick={() => download(d.id)}>
                      <Download className="mr-1.5 h-4 w-4" />Download ({d.download_count})
                    </Button>
                    {isStaff && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => toggle(d.id)}><History className="mr-1.5 h-4 w-4" />Versions</Button>
                        <Button size="sm" variant="ghost" loading={busy} onClick={() => remove(d.id)}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                </div>
                {d.description && <p className="mt-2 text-sm text-gray-600">{d.description}</p>}
                {d.current && (
                  <p className="mt-2 text-xs text-gray-400">
                    v{d.current.version_number} · {d.current.file_name}
                    {d.current.file_size ? ` · ${formatFileSize(d.current.file_size)}` : ""} · by {d.current.uploaded_by_name} · {formatDate(d.current.uploaded_at)}
                  </p>
                )}

                {expanded.has(d.id) && isStaff && (
                  <div className="mt-4 space-y-3 rounded-lg bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-700">Version History</p>
                    {(d.versions || []).length === 0 ? (
                      <p className="text-sm text-gray-400">No versions recorded.</p>
                    ) : (
                      (d.versions || []).map((v) => (
                        <div key={v.version_number} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                          <p className="font-medium text-gray-800">v{v.version_number} · {v.file_name}</p>
                          <p className="text-xs text-gray-400">by {v.uploaded_by_name} · {formatDate(v.uploaded_at)}</p>
                          {v.notes && <p className="mt-1 text-xs text-gray-500">“{v.notes}”</p>}
                        </div>
                      ))
                    )}
                    <div className="space-y-2 border-t border-gray-200 pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => openFilePicker(d.id)}>
                          <UploadCloud className="mr-1.5 h-4 w-4" />Upload File
                        </Button>
                        <span className="text-xs text-gray-400">or add text below</span>
                      </div>
                      <textarea
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        rows={3}
                        value={versionForm[d.id]?.content || ""}
                        onChange={(e) => setVersionForm({ ...versionForm, [d.id]: { ...(versionForm[d.id] || {}), content: e.target.value } })}
                        placeholder="New version content..."
                      />
                      <Input value={versionForm[d.id]?.notes || ""} onChange={(e) => setVersionForm({ ...versionForm, [d.id]: { ...(versionForm[d.id] || {}), notes: e.target.value } })} placeholder="What changed?" />
                      <Button size="sm" loading={busy} onClick={() => addVersion(d.id, d.title)}>Add Version v{(d.versions?.length || 0) + 1}</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {modalOpen && (
        <VaultUploadModal
          key={`${modalDocId || "new"}-${modalSeq}`}
          open
          onClose={closeModal}
          onUploaded={() => {
            closeModal();
            showNotice(modalDocId ? "New version uploaded successfully." : "Document uploaded successfully.", "success");
            load();
          }}
          documentId={modalDocId}
          initialFile={modalFile}
        />
      )}
    </AppLayout>
  );
}