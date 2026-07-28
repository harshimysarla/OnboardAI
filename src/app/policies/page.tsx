"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, Plus, Search } from "lucide-react";
import { useUser } from "@/lib/use-user";

interface Policy {
  id: string;
  title: string;
  category: string;
  content: string;
  created_at?: string;
}

export default function PoliciesPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Policy | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ title: "", category: "Other", content: "" });

  const isAdmin = user?.role === "admin" || user?.role === "hr";

  useEffect(() => {
    fetch("/api/policies")
      .then(r => r.json())
      .then(data => {
        setPolicies(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selected) {
      fetch("/api/policies?id=" + selected.id)
        .then(r => r.json())
        .then(full => {
          if (full && full.content) setSelected(full);
        })
        .catch(() => {});
    }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  const filtered = policies.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!form.title || !form.content) return;
    const res = await fetch("/api/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const created = await res.json();
      setPolicies(prev => [...prev, created]);
      setShowAdd(false);
      setForm({ title: "", category: "Other", content: "" });
    }
  };

  const handleEdit = async () => {
    if (!selected || !form.title || !form.content) return;
    const res = await fetch("/api/policies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, ...form }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPolicies(prev => prev.map(p => p.id === updated.id ? updated : p));
      setSelected(updated);
      setShowEdit(false);
    }
  };

  const openEdit = () => {
    if (!selected) return;
    setForm({ title: selected.title, category: selected.category, content: selected.content || "" });
    setShowEdit(true);
  };

  const policyCategories = ["HR", "IT", "Finance", "Security", "Operations", "Benefits", "Code of Conduct", "Other"];

  return (
    <AppLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Policies</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your company&apos;s policy documents</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setForm({ title: "", category: "Other", content: "" }); setShowAdd(true); }}>
            <Plus className="mr-2 h-4 w-4" />Add Policy
          </Button>
        )}
      </div>

      {policies.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="No policies yet"
          description="Add your first company policy."
          action={isAdmin ? <Button onClick={() => { setForm({ title: "", category: "Other", content: "" }); setShowAdd(true); }}><Plus className="mr-2 h-4 w-4" />Add Policy</Button> : undefined}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search policies..."
                    className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </CardContent>
            </Card>
            <div className="mt-4 space-y-2">
              {filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={"w-full text-left rounded-lg border p-3 transition-colors " + (selected?.id === p.id ? "border-indigo-300 bg-indigo-50" : "border-gray-200 hover:border-gray-300")}
                >
                  <p className="text-sm font-medium text-gray-900">{p.title}</p>
                  <Badge variant="info" className="mt-1">{p.category}</Badge>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            {selected ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selected.title}</CardTitle>
                      <Badge variant="info" className="mt-1">{selected.category}</Badge>
                    </div>
                    {isAdmin && <Button variant="outline" size="sm" onClick={openEdit}>Edit</Button>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">{selected.content}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                icon={<FileText className="h-12 w-12" />}
                title="Select a policy"
                description="Choose a policy from the list to view its contents."
              />
            )}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900">Add Policy</h2>
            <p className="mt-1 text-sm text-gray-500">Create a new company policy</p>
            <div className="mt-4 space-y-3">
              <Input label="Policy Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              <Select label="Category" value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                options={policyCategories.map(c => ({ value: c, label: c }))} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={8}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd}>Save Policy</Button>
            </div>
          </div>
        </div>
      )}

      {showEdit && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowEdit(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900">Edit Policy</h2>
            <p className="mt-1 text-sm text-gray-500">{selected.title}</p>
            <div className="mt-4 space-y-3">
              <Input label="Policy Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              <Select label="Category" value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                options={policyCategories.map(c => ({ value: c, label: c }))} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={8}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
              <Button onClick={handleEdit}>Update Policy</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
