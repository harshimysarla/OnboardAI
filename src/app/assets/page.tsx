"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { useUser } from "@/lib/use-user";
import { Laptop, Trash2 } from "lucide-react";

interface Asset {
  id: string;
  name: string;
  type: string;
  serial_number: string;
  status: string;
  assigned_name?: string;
  assigned_at?: string;
  notes?: string;
}

const STATUS_META: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  available: { label: "Available", variant: "success" },
  assigned: { label: "Assigned", variant: "info" },
  maintenance: { label: "Maintenance", variant: "warning" },
  retired: { label: "Retired", variant: "danger" },
};

const TYPE_LABEL: Record<string, string> = {
  laptop: "Laptop",
  monitor: "Monitor",
  phone: "Phone",
  peripheral: "Peripheral",
  software: "Software",
  other: "Other",
};

export default function AssetsPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "laptop", serial_number: "", notes: "" });

  const isStaff = user?.role === "admin" || user?.role === "hr";

  const load = useCallback(async () => {
    const res = await fetch("/api/assets");
    if (!res.ok) return;
    const data = await res.json();
    setAssets(data.assets || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  useEffect(() => {
    if (!isStaff) return;
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [isStaff]);

  const create = async () => {
    if (!form.name.trim()) {
      setMessage("Asset name is required");
      return;
    }
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Unable to create asset");
      return;
    }
    setForm({ name: "", type: "laptop", serial_number: "", notes: "" });
    setShowForm(false);
    load();
  };

  const assign = async (id: string, employeeId: string) => {
    setBusy(true);
    await fetch("/api/assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, assigned_to: employeeId || "" }),
    });
    setBusy(false);
    load();
  };

  const setStatus = async (id: string, status: string) => {
    setBusy(true);
    await fetch("/api/assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBusy(false);
    load();
  };

  const remove = async (id: string) => {
    setBusy(true);
    await fetch(`/api/assets?id=${id}`, { method: "DELETE" });
    setBusy(false);
    load();
  };

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isStaff ? "Assets" : "My Assets"}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isStaff ? "Manage company equipment and assignments" : "Equipment assigned to you"}
          </p>
        </div>
        {isStaff && <Button onClick={() => setShowForm(!showForm)}><Laptop className="mr-2 h-4 w-4" />Add Asset</Button>}
      </div>

      {message && <p className="mb-4 text-sm text-red-600">{message}</p>}

      {showForm && isStaff && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add Asset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. MacBook Pro" />
              <div>
                <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                  options={Object.entries(TYPE_LABEL).map(([k, v]) => ({ value: k, label: v }))} />
              </div>
              <Input label="Serial Number" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
              <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button loading={busy} onClick={create}>Create Asset</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isStaff ? "All Assets" : "Assigned to Me"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {assets.length === 0 ? (
            <div className="py-10">
              <EmptyState icon={<Laptop className="h-12 w-12" />} title="No assets" description={isStaff ? "Add an asset to get started." : "No equipment has been assigned to you yet."} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-400 uppercase">
                    <th className="px-6 py-3">Asset</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Serial</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Assigned To</th>
                    {isStaff && <th className="px-6 py-3">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <p className="font-medium text-gray-900">{a.name}</p>
                        {a.notes && <p className="text-xs text-gray-400">{a.notes}</p>}
                      </td>
                      <td className="px-6 py-3 text-gray-600">{TYPE_LABEL[a.type] || a.type}</td>
                      <td className="px-6 py-3 text-gray-600">{a.serial_number || "—"}</td>
                      <td className="px-6 py-3"><Badge variant={STATUS_META[a.status]?.variant || "default"}>{STATUS_META[a.status]?.label || a.status}</Badge></td>
                      <td className="px-6 py-3 text-gray-600">
                        {a.status === "assigned" && a.assigned_name ? (
                          <span>{a.assigned_name}{a.assigned_at ? ` · since ${formatDate(a.assigned_at)}` : ""}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      {isStaff && (
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <select
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                              value={a.assigned_name || ""}
                              onChange={(e) => assign(a.id, e.target.value)}
                            >
                              <option value="">Unassigned</option>
                              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                            </select>
                            <select
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                              value={a.status}
                              onChange={(e) => setStatus(a.id, e.target.value)}
                            >
                              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <Button size="sm" variant="ghost" loading={busy} onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}