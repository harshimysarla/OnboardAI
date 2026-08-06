"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
import { Building2, Users, Shield, KeyRound, Copy, Check, RefreshCw, Pencil, Save, X, AlertTriangle } from "lucide-react";
import { useUser } from "@/lib/use-user";

interface Department { id: string; name: string; employee_count?: number; }
interface RoleCount { role: string; count: number; }

const CODE_PATTERN = /^[A-Z0-9_-]{3,20}$/;
const CODE_HINT = "3-20 characters: letters, numbers, hyphens (-) or underscores (_).";

export default function CompanyPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<RoleCount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftCode, setDraftCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirming, setConfirming] = useState<"custom" | "regenerate" | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      fetch("/api/employees").then(r => r.json()),
      fetch("/api/company").then(r => r.json()).catch(() => null),
    ]).then(([emps, company]) => {
      const employees = Array.isArray(emps) ? emps : [];

      const deptMap = new Map<string, number>();
      employees.forEach((e: Record<string, unknown>) => {
        const d = (e.department as string) || "Unassigned";
        deptMap.set(d, (deptMap.get(d) || 0) + 1);
      });
      setDepartments(Array.from(deptMap.entries()).map(([name, count]) => ({
        id: name, name, employee_count: count,
      })));

      const roleCounts: RoleCount[] = [];
      const adminCount = employees.filter((e: Record<string, unknown>) => (e.job_title as string || "").toLowerCase().includes("admin")).length;
      if (adminCount > 0) roleCounts.push({ role: "Admin", count: adminCount });
      roleCounts.push({ role: "Employee", count: employees.length });
      setRoles(roleCounts);

      if (company && typeof company === "object" && "access_code" in (company as object)) {
        setAccessCode((company as Record<string, string>).access_code || "");
      }
      setLoading(false);
    }).catch(() => {
      setError("Failed to load company data");
      setLoading(false);
    });
  }, [user]);

  const handleCopyCode = async () => {
    if (!accessCode) return;
    try {
      await navigator.clipboard.writeText(accessCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const startEdit = () => {
    setDraftCode(accessCode);
    setNotice(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftCode("");
    setNotice(null);
  };

  const requestSave = () => {
    if (!CODE_PATTERN.test(draftCode)) {
      setNotice({ type: "error", text: `Invalid Company Access Code. ${CODE_HINT}` });
      return;
    }
    setNotice(null);
    setConfirming("custom");
  };

  const requestRegenerate = () => {
    setNotice(null);
    setConfirming("regenerate");
  };

  const confirmChange = async () => {
    if (!user || saving || regenerating) return;
    const isCustom = confirming === "custom";
    setSaving(true);
    setRegenerating(true);
    setConfirming(null);
    try {
      const res = await fetch("/api/company/access-code", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: isCustom ? JSON.stringify({ code: draftCode }) : undefined,
      });
      const data = await res.json();
      if (res.ok && data.access_code) {
        setAccessCode(data.access_code);
        setEditing(false);
        setDraftCode("");
        setNotice({ type: "success", text: `Company Access Code updated to ${data.access_code}. All employees must now use the new code to log in.` });
      } else {
        setNotice({ type: "error", text: (data as { error?: string })?.error || "Failed to update Company Access Code." });
      }
    } catch {
      setNotice({ type: "error", text: "Failed to update Company Access Code." });
    }
    setSaving(false);
    setRegenerating(false);
  };

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Company</h1>
        <p className="mt-1 text-sm text-gray-500">Your organization overview</p>
      </div>

      {notice && (
        <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${notice.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {notice.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              <CardTitle>Company</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg font-semibold text-gray-900">{user?.company_name || "Your Company"}</p>
            <p className="text-xs text-gray-400">
              {error || "Company profile loaded from your account."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              <CardTitle>Departments ({departments.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {departments.length === 0 ? (
              <p className="text-sm text-gray-500">No departments yet. Add employees to see departments.</p>
            ) : (
              <div className="space-y-2">
                {departments.map((dept) => (
                  <div key={dept.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>{dept.name}</span>
                    <span className="text-xs text-gray-400">{dept.employee_count} employees</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-indigo-500" />
              <CardTitle>Company Access Code</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">
              Every employee uses this code (with their email and password) to sign in. Tenants are fully isolated even if two companies have the same email.
            </p>
            {user?.role === "admin" && accessCode ? (
              editing ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">New Company Access Code</label>
                    <input
                      value={draftCode}
                      onChange={(e) => setDraftCode(e.target.value.toUpperCase())}
                      maxLength={20}
                      placeholder="e.g. IARE2026"
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-lg font-bold tracking-widest text-indigo-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                    <p className="text-xs text-gray-400">{CODE_HINT}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={requestSave} loading={saving} disabled={!draftCode}>
                      <Save className="h-4 w-4" />
                      Save
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-indigo-400">Current Code</p>
                      <span className="block truncate font-mono text-xl font-bold tracking-widest text-indigo-700">{accessCode}</span>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleCopyCode}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="flex-1" onClick={startEdit}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={requestRegenerate} loading={regenerating}>
                      <RefreshCw className="h-4 w-4" />
                      Regenerate
                    </Button>
                  </div>
                </>
              )
            ) : (
              <p className="text-sm text-gray-400">Ask your administrator for the company access code.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-500" />
              <CardTitle>Roles</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {roles.length === 0 ? (
              <p className="text-sm text-gray-500">No role data available.</p>
            ) : (
              <div className="space-y-2">
                {roles.map((r) => (
                  <div key={r.role} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>{r.role}</span>
                    <span className="text-xs text-gray-400">{r.count} users</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Change Company Access Code?</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Changing your Company Access Code means all employees must use the new code during login.
                </p>
                <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 font-mono text-sm font-bold tracking-widest text-indigo-700">
                  {confirming === "custom" ? draftCode : "A new random code will be generated"}
                </p>
                <p className="mt-2 text-xs text-gray-400">The old code will stop working immediately. Continue?</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={confirmChange} loading={saving || regenerating}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
