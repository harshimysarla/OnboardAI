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
import { CalendarDays, CalendarPlus, CheckCircle2, XCircle, Clock } from "lucide-react";

interface LeaveReq {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason?: string;
  status: string;
  created_at?: string;
  employee?: { id: string; full_name: string; email: string } | null;
}

interface BalanceEntry {
  total: number;
  used: number;
  available: number;
}

type Balances = Record<string, BalanceEntry>;

const STATUS_META: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  pending: { label: "Manager Review", variant: "warning" },
  hr_pending: { label: "HR Review", variant: "info" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "default" },
};

const TYPE_LABEL: Record<string, string> = {
  annual: "Annual",
  sick: "Sick",
  casual: "Casual",
  unpaid: "Unpaid",
  other: "Other",
};

export default function LeavesPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveReq[]>([]);
  const [balances, setBalances] = useState<Balances>({});
  const [pending, setPending] = useState<LeaveReq[]>([]);
  const [canApproveFinal, setCanApproveFinal] = useState(false);
  const [analytics, setAnalytics] = useState<{ total: number; thisMonth: number; pending: number; byType: { type: string; count: number; days: number }[] } | null>(null);

  const [form, setForm] = useState({ leave_type: "annual", start_date: "", end_date: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const role = user?.role || "employee";
  const isStaff = role === "admin" || role === "hr";
  const canManage = isStaff || role === "manager";

  const load = useCallback(async () => {
    const [mineRes, pendingRes, analyticsRes] = await Promise.all([
      fetch("/api/leaves"),
      canManage ? fetch("/api/leaves?scope=pending") : Promise.resolve(null),
      isStaff ? fetch("/api/leaves?scope=analytics") : Promise.resolve(null),
    ]);
    if (mineRes.ok) {
      const data = await mineRes.json();
      setRequests(data.requests || []);
      setBalances(data.balances || {});
    }
    if (pendingRes && pendingRes.ok) {
      const data = await pendingRes.json();
      setPending(data.requests || []);
      setCanApproveFinal(!!data.canApproveFinal);
    }
    if (analyticsRes && analyticsRes.ok) {
      const data = await analyticsRes.json();
      setAnalytics(data);
    }
    setLoading(false);
  }, [canManage, isStaff]);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  const apply = async () => {
    if (!form.start_date || !form.end_date) {
      setMessage("Please select start and end dates");
      return;
    }
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Unable to apply for leave");
      return;
    }
    setForm({ leave_type: "annual", start_date: "", end_date: "", reason: "" });
    load();
  };

  const cancelRequest = async (id: string) => {
    setBusy(true);
    const res = await fetch(`/api/leaves?id=${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Unable to cancel request");
      return;
    }
    load();
  };

  const decide = async (id: string, decision: "approve" | "reject") => {
    setBusy(true);
    const res = await fetch("/api/leaves", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Unable to update request");
      return;
    }
    load();
  };

  const balanceOrder = ["annual", "sick", "casual", "unpaid", "other"];

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isStaff ? "Review and manage team leave requests" : "Apply for leave and view your balances"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {analytics && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card><CardContent className="p-5 text-center">
                <p className="text-sm text-gray-500">Total Requests</p>
                <p className="mt-1 text-2xl font-bold text-indigo-600">{analytics.total}</p>
              </CardContent></Card>
              <Card><CardContent className="p-5 text-center">
                <p className="text-sm text-gray-500">Pending Approval</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{analytics.pending}</p>
              </CardContent></Card>
              <Card><CardContent className="p-5 text-center">
                <p className="text-sm text-gray-500">This Month</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{analytics.thisMonth}</p>
              </CardContent></Card>
            </div>
          )}

          {canManage && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-500" />
                  <CardTitle>Approval Queue</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {pending.length === 0 ? (
                  <div className="py-10">
                    <EmptyState icon={<CheckCircle2 className="h-12 w-12" />} title="Queue is clear" description="No leave requests awaiting your decision." />
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {pending.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{r.employee?.full_name || "Employee"}</p>
                            <Badge variant={STATUS_META[r.status]?.variant || "default"}>{STATUS_META[r.status]?.label || r.status}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-gray-500">
                            {TYPE_LABEL[r.leave_type] || r.leave_type} · {formatDate(r.start_date)} → {formatDate(r.end_date)} ({r.days} day{r.days !== 1 ? "s" : ""})
                          </p>
                          {r.reason && <p className="mt-1 text-sm text-gray-400">“{r.reason}”</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" loading={busy} onClick={() => decide(r.id, "reject")}>
                            <XCircle className="mr-1.5 h-4 w-4" />Reject
                          </Button>
                          <Button size="sm" loading={busy} onClick={() => decide(r.id, "approve")}>
                            <CheckCircle2 className="mr-1.5 h-4 w-4" />
                            {canApproveFinal || role === "manager" ? "Approve" : "Approve"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-indigo-500" />
                <CardTitle>{canManage ? "All Requests" : "My Requests"}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {requests.length === 0 ? (
                <div className="py-10">
                  <EmptyState icon={<CalendarDays className="h-12 w-12" />} title="No leave requests" description="Apply for leave to get started." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-400 uppercase">
                        {isStaff && <th className="px-6 py-3">Employee</th>}
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Dates</th>
                        <th className="px-6 py-3">Days</th>
                        <th className="px-6 py-3">Status</th>
                        {!isStaff && <th className="px-6 py-3"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((r) => (
                        <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                          {isStaff && <td className="px-6 py-3 font-medium text-gray-900">{r.employee?.full_name || r.reason ? "" : "—"}</td>}
                          <td className="px-6 py-3 text-gray-700 capitalize">{TYPE_LABEL[r.leave_type] || r.leave_type}</td>
                          <td className="px-6 py-3 text-gray-600">{formatDate(r.start_date)} → {formatDate(r.end_date)}</td>
                          <td className="px-6 py-3 text-gray-600">{r.days}</td>
                          <td className="px-6 py-3">
                            <Badge variant={STATUS_META[r.status]?.variant || "default"}>{STATUS_META[r.status]?.label || r.status}</Badge>
                          </td>
                          {!isStaff && (
                            <td className="px-6 py-3 text-right">
                              {(r.status === "pending" || r.status === "hr_pending") && (
                                <Button size="sm" variant="ghost" loading={busy} onClick={() => cancelRequest(r.id)}>
                                  Cancel
                                </Button>
                              )}
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
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-indigo-500" />
                <CardTitle>Apply for Leave</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Leave Type"
                value={form.leave_type}
                onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
                options={balanceOrder.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
              />
              <Input type="date" label="Start Date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              <Input type="date" label="End Date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              <Input label="Reason (optional)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Family vacation" />
              <Button className="w-full" loading={busy} disabled={!user?.employee_id} onClick={apply}>
                Submit Request
              </Button>
              {message && <p className="text-sm text-red-600">{message}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>My Balances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {balanceOrder.map((t) => {
                const b = balances[t];
                if (!b) return null;
                const pct = b.total > 0 ? Math.min(100, Math.round((b.used / b.total) * 100)) : 0;
                return (
                  <div key={t}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize text-gray-800">{TYPE_LABEL[t]}</span>
                      <span className="text-gray-500">{b.available} available · {b.used}/{b.total} used</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}