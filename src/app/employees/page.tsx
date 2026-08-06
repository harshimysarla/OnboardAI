"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { getRiskColor, getRiskDot, formatDate } from "@/lib/utils";
import { Plus, Users, Copy, Check, History } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/lib/use-user";
import { Employee } from "@/types";

interface InvitationRecord {
  id: string;
  email: string;
  status: "pending" | "accepted" | "completed";
  access_code: string;
  invited_by_name: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
};

export default function EmployeesPage() {
  const { user } = useUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [newEmp, setNewEmp] = useState({ full_name: "", email: "", job_title: "", department: "", manager: "", joining_date: "" });
  const [accessCode, setAccessCode] = useState("");
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [inviteModal, setInviteModal] = useState<{ email: string; tempPassword: string } | null>(null);
  const [addError, setAddError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/employees").then(res => res.json()).catch(() => []),
      fetch("/api/departments").then(res => res.json()).catch(() => []),
      fetch("/api/company").then(res => res.json()).catch(() => null),
    ]).then(([emps, depts, company]) => {
      setEmployees(Array.isArray(emps) ? emps : []);
      if (Array.isArray(depts)) {
        setDepartments(depts.map((d: { name: string }) => d.name).filter(Boolean));
      }
      if (company?.access_code) setAccessCode(company.access_code);
      setLoading(false);
    });
  }, []);

  const handleOpenHistory = async () => {
    setShowHistory(true);
    try {
      const res = await fetch("/api/invitations");
      const data = await res.json();
      setInvitations(Array.isArray(data) ? data : []);
    } catch {}
  };

  const depts = [...new Set([...departments, ...employees.map(e => e.department).filter(Boolean)])];
  const filtered = employees.filter(e => {
    const matchSearch = !search || e.full_name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (!deptFilter || e.department === deptFilter);
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const handleAdd = async () => {
    if (!newEmp.full_name || !newEmp.email || !newEmp.joining_date) return;
    setAddError("");
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newEmp),
    });
    const created = await res.json().catch(() => null);
    if (!res.ok || !created) {
      setAddError(typeof created?.error === "string" ? created.error : "Failed to create employee. Please try again.");
      return;
    }
    setEmployees(prev => [...prev, created]);
    setShowAdd(false);
    const tp = created.temporary_password as string | undefined;
    if (tp) {
      setInviteModal({ email: newEmp.email, tempPassword: tp });
    }
    setNewEmp({ full_name: "", email: "", job_title: "", department: "", manager: "", joining_date: "" });
    fetch("/api/departments")
      .then(res => res.json())
      .then(deps => {
        if (Array.isArray(deps)) {
          setDepartments(deps.map((d: { name: string }) => d.name).filter(Boolean));
        }
      })
      .catch(() => {});
  };

  if (loading) return <AppLayout><LoadingSpinner size="md" /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="mt-1 text-sm text-gray-500">Manage and view employee onboarding</p>
        </div>
        <div className="flex gap-2">
          {(user?.role === "admin" || user?.role === "hr") && (
            <>
              <Button variant="outline" size="sm" onClick={handleOpenHistory}>
                <History className="mr-1.5 h-4 w-4" />History
              </Button>
              <Button onClick={() => setShowAdd(true)}><Plus className="mr-2 h-4 w-4" />Add Employee</Button>
            </>
          )}
        </div>
      </div>

      {/* Invitation History Dialog */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowHistory(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900">Invitation History</h2>
            <p className="mt-1 text-sm text-gray-500">Recent employee invitations and their status</p>
            {invitations.length === 0 ? (
              <p className="mt-6 text-center text-sm text-gray-400">No invitations sent yet.</p>
            ) : (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-400 uppercase">
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Invited by</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-900">{inv.email}</td>
                      <td className="py-2 pr-4 text-gray-600">{inv.invited_by_name || "-"}</td>
                      <td className="py-2 pr-4"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status] || ""}`}>{inv.status}</span></td>
                      <td className="py-2 text-gray-500">{formatDate(inv.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowHistory(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Invitation credential modal */}
      {inviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setInviteModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900">Employee created</h2>
            <p className="mt-1 text-sm text-gray-500">Share these credentials with <strong>{inviteModal.email}</strong></p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2">
                <span className="text-xs text-gray-500">Access Code</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold">{accessCode}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(accessCode, "code")}>
                    {copied === "code" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2">
                <span className="text-xs text-gray-500">Email</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{inviteModal.email}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(inviteModal.email, "email")}>
                    {copied === "email" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-amber-50 px-3 py-2">
                <span className="text-xs text-gray-500">Temp Password</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm select-all">{inviteModal.tempPassword}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(inviteModal.tempPassword, "pw")}>
                    {copied === "pw" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-amber-700">The password is shown only once. Copy it now.</p>
            <Button className="mt-4 w-full" onClick={() => setInviteModal(null)}>Done</Button>
          </div>
        </div>
      )}

      {employees.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No employees yet"
          description="Add your first employee to get started."
          action={user?.role === "admin" || user?.role === "hr" ? <Button onClick={() => setShowAdd(true)}><Plus className="mr-2 h-4 w-4" />Add Employee</Button> : undefined}
        />
      ) : (
        <>
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <Input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} />
                <Select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                  options={[{ value: "", label: "All Departments" }, ...depts.map(d => ({ value: d, label: d }))]} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Employee</TH>
                    <TH>Role</TH>
                    <TH>Department</TH>
                    <TH>Joining Date</TH>
                    <TH>Progress</TH>
                    <TH>Risk</TH>
                    <TH>Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map(emp => (
                    <TR key={emp.id}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-700">
                            {emp.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{emp.full_name}</p>
                            <p className="text-xs text-gray-500">{emp.email}</p>
                          </div>
                        </div>
                      </TD>
                      <TD className="text-gray-600">{emp.job_title}</TD>
                      <TD className="text-gray-600">{emp.department}</TD>
                      <TD className="text-gray-600">{formatDate(emp.joining_date)}</TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Progress value={emp.progress} className="w-20" />
                          <span className="text-xs font-medium text-gray-600">{emp.progress}%</span>
                        </div>
                      </TD>
                      <TD>
                        <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium " + getRiskColor(emp.risk_level)}>
                          <span className={"h-1.5 w-1.5 rounded-full " + getRiskDot(emp.risk_level)} />
                          {emp.risk_level === "green" ? "On Track" : emp.risk_level === "yellow" ? "Attention" : "High Risk"}
                        </span>
                      </TD>
                      <TD>
                        <Link href={"/employees/" + emp.id}><Button variant="ghost" size="sm">View</Button></Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900">Add Employee</h2>
            <p className="mt-1 text-sm text-gray-500">An account will be created with a temporary password</p>
            <div className="mt-4 space-y-3">
              <Input label="Full Name" value={newEmp.full_name} onChange={e => setNewEmp({...newEmp, full_name: e.target.value})} />
              <Input label="Email" type="email" value={newEmp.email} onChange={e => setNewEmp({...newEmp, email: e.target.value})} />
              <Input label="Job Title" value={newEmp.job_title} onChange={e => setNewEmp({...newEmp, job_title: e.target.value})} />
              <Select label="Department" value={newEmp.department} onChange={e => setNewEmp({...newEmp, department: e.target.value})}
                options={[{ value: "", label: "Select department" }, ...depts.map(d => ({ value: d, label: d }))]} />
              <Input label="Manager" value={newEmp.manager} onChange={e => setNewEmp({...newEmp, manager: e.target.value})} />
              <Input label="Joining Date" type="date" value={newEmp.joining_date} onChange={e => setNewEmp({...newEmp, joining_date: e.target.value})} />
            </div>
            {addError && <p className="text-sm font-medium text-red-600">{addError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd}>Create Employee</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}