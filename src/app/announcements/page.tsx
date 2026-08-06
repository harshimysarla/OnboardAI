"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/utils";
import { useUser } from "@/lib/use-user";
import { Megaphone, ThumbsUp, Bookmark, MessageSquare, Pin, Trash2 } from "lucide-react";

interface Comment {
  id: string;
  user_id: string;
  full_name: string;
  content: string;
  created_at: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  pinned: boolean;
  author_name: string;
  published_at: string;
  like_count: number;
  liked_by_me: boolean;
  bookmark_count: number;
  bookmarked_by_me: boolean;
  comment_count: number;
  comments: Comment[];
}

const CATEGORY_META: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  general: { label: "General", variant: "default" },
  important: { label: "Important", variant: "danger" },
  event: { label: "Event", variant: "info" },
  training: { label: "Training", variant: "success" },
};

export default function AnnouncementsPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({ title: "", content: "", category: "general", pinned: false });
  const [commentText, setCommentText] = useState<Record<string, string>>({});

  const isStaff = user?.role === "admin" || user?.role === "hr";

  const load = useCallback(async () => {
    const res = await fetch("/api/announcements");
    if (!res.ok) return;
    const data = await res.json();
    setAnnouncements(data.announcements || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  const create = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setMessage("Title and content are required");
      return;
    }
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Unable to post announcement");
      return;
    }
    setForm({ title: "", content: "", category: "general", pinned: false });
    load();
  };

  const interact = async (id: string, action: string, content?: string) => {
    setBusy(true);
    const res = await fetch("/api/announcements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, content }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Action failed");
      return;
    }
    if (content) setCommentText((prev) => ({ ...prev, [id]: "" }));
    load();
  };

  const remove = async (id: string) => {
    setBusy(true);
    await fetch(`/api/announcements?id=${id}`, { method: "DELETE" });
    setBusy(false);
    load();
  };

  const toggleComments = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visible = announcements.filter((a) => filter === "all" || a.category === filter);
  const filtered = filter === "bookmarked" ? visible.filter((a) => a.bookmarked_by_me) : visible;

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="mt-1 text-sm text-gray-500">Company news, events and updates</p>
        </div>
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-44"
          options={[
            { value: "all", label: "All" },
            { value: "important", label: "Important" },
            { value: "event", label: "Events" },
            { value: "training", label: "Training" },
            { value: "general", label: "General" },
            { value: "bookmarked", label: "Bookmarked" },
          ]}
        />
      </div>

      {isStaff && (
        <Card className="mb-6">
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="min-w-[280px] flex-1">
                <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Office party next Friday" />
              </div>
              <div className="w-44">
                <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  options={["general", "important", "event", "training"].map((c) => ({ value: c, label: CATEGORY_META[c].label }))} />
              </div>
              <label className="mt-7 flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                Pin
              </label>
            </div>
            <Input label="Content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Share an update with the team..." />
            <Button loading={busy} onClick={create}>
              <Megaphone className="mr-2 h-4 w-4" />Post Announcement
            </Button>
            {message && <p className="text-sm text-red-600">{message}</p>}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState icon={<Megaphone className="h-12 w-12" />} title="No announcements" description="Nothing here yet. Check back later for company updates." />
            </CardContent>
          </Card>
        ) : (
          filtered.map((a) => (
            <Card key={a.id} className={a.pinned ? "border-indigo-300" : ""}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {a.pinned && <Pin className="h-4 w-4 text-indigo-500" />}
                    <h3 className="font-semibold text-gray-900">{a.title}</h3>
                    <Badge variant={CATEGORY_META[a.category]?.variant || "default"}>{CATEGORY_META[a.category]?.label || a.category}</Badge>
                  </div>
                  {isStaff && (
                    <Button size="sm" variant="ghost" loading={busy} onClick={() => remove(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">{a.author_name} · {formatDateTime(a.published_at)}</p>
                <p className="mt-3 whitespace-pre-line text-sm text-gray-700">{a.content}</p>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                  <Button size="sm" variant={a.liked_by_me ? "primary" : "outline"} loading={busy} onClick={() => interact(a.id, "like")}>
                    <ThumbsUp className="mr-1.5 h-4 w-4" />{a.like_count}
                  </Button>
                  <Button size="sm" variant={a.bookmarked_by_me ? "primary" : "outline"} loading={busy} onClick={() => interact(a.id, "bookmark")}>
                    <Bookmark className="mr-1.5 h-4 w-4" />{a.bookmark_count}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleComments(a.id)}>
                    <MessageSquare className="mr-1.5 h-4 w-4" />{a.comment_count} Comments
                  </Button>
                </div>

                {expanded.has(a.id) && (
                  <div className="mt-4 space-y-3 rounded-lg bg-gray-50 p-4">
                    <div className="flex gap-2">
                      <Input value={commentText[a.id] || ""} onChange={(e) => setCommentText({ ...commentText, [a.id]: e.target.value })}
                        placeholder="Write a comment..." />
                      <Button size="sm" loading={busy} disabled={!(commentText[a.id] || "").trim()} onClick={() => interact(a.id, "comment", (commentText[a.id] || "").trim())}>
                        Post
                      </Button>
                    </div>
                    {a.comments.length === 0 ? (
                      <p className="text-sm text-gray-400">No comments yet.</p>
                    ) : (
                      a.comments.map((c) => (
                        <div key={c.id || c.created_at} className="rounded-lg bg-white p-3 shadow-sm">
                          <p className="text-xs font-medium text-gray-700">{c.full_name} <span className="font-normal text-gray-400">· {formatDateTime(c.created_at)}</span></p>
                          <p className="mt-1 text-sm text-gray-600">{c.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppLayout>
  );
}