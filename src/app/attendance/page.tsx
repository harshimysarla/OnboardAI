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
import { formatDateTime } from "@/lib/utils";
import { LogIn, LogOut, Play, Pause, CalendarDays, Timer, AlertTriangle } from "lucide-react";
import { useUser } from "@/lib/use-user";

interface AttRecord {
  id: string;
  date: string;
  check_in?: string;
  check_out?: string;
  work_seconds: number;
  break_seconds: number;
  is_late: boolean;
  late_minutes: number;
  breaks?: { start?: string; end?: string }[];
  employee?: { full_name: string; email: string; job_title: string };
}

interface Summary {
  present: number;
  absent: number;
  lateDays: number;
  totalHours: number;
  avgHours: number;
  days: number;
}

function fmtHours(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function AttendancePage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<AttRecord | null>(null);
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // admin report state
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [empFilter, setEmpFilter] = useState("");

  const isAdmin = user?.role === "admin" || user?.role === "hr";

  const load = useCallback(async () => {
    const qs = month ? `?month=${month}` : "";
    const url = isAdmin ? `/api/attendance/report${qs}${empFilter ? "&employeeId=" + empFilter : ""}` : `/api/attendance${qs}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    setRecords(data.records || []);
    setSummary(data.summary || null);
    const todayKey = new Date().toISOString().slice(0, 10);
    const rec = (data.records || []).find((r: AttRecord) => (r.date || "").slice(0, 10) === todayKey);
    setToday(rec || null);
    setLoading(false);
  }, [isAdmin, month, empFilter]);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [isAdmin]);

  const act = async (action: string) => {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Action failed");
      return;
    }
    load();
  };

  const exportCSV = () => {
    if (!records.length) return;
    const header = "Date,Employee,Check In,Check Out,Work Hours,Break Hours,Late (min),Status";
    const rows = records.map((r) =>
      [
        (r.date || "").slice(0, 10),
        r.employee?.full_name || user?.name || "",
        r.check_in ? formatDateTime(r.check_in) : "",
        r.check_out ? formatDateTime(r.check_out) : "",
        fmtHours(r.work_seconds || 0),
        fmtHours(r.break_seconds || 0),
        r.is_late ? r.late_minutes : 0,
        !r.check_in ? "Absent" : r.is_late ? "Late" : "Present",
      ].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isAdmin ? "Team attendance reports" : "Track your daily check-in, breaks and hours"}
        </p>
      </div>

      {!isAdmin && (
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-sm text-indigo-200">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
              <div className="mt-2 flex items-center gap-2">
                {today?.check_in ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-sm font-medium">
                    <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                    {today.check_out ? "Day complete" : today.breaks?.some((b) => b.start && !b.end) ? "On break" : "Checked in"}
                  </span>
                ) : (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium">Not checked in yet</span>
                )}
                {today?.is_late && !today.check_out && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-medium">
                    <AlertTriangle className="h-3.5 w-3.5" /> {today.late_minutes} min late
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {!today?.check_in ? (
                <Button className="bg-white text-indigo-700 hover:bg-indigo-50" onClick={() => act("check-in")} loading={busy} disabled={!user?.employee_id}>
                  <LogIn className="mr-2 h-4 w-4" />Check In
                </Button>
              ) : !today.check_out ? (
                <>
                  {today.breaks?.some((b) => b.start && !b.end) ? (
                    <Button variant="secondary" onClick={() => act("break-end")} loading={busy}>
                      <Play className="mr-2 h-4 w-4" />End Break
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => act("break-start")} loading={busy}>
                      <Pause className="mr-2 h-4 w-4" />Start Break
                    </Button>
                  )}
                  <Button onClick={() => act("check-out")} loading={busy}>
                    <LogOut className="mr-2 h-4 w-4" />Check Out
                  </Button>
                </>
              ) : (
                <Badge variant="success">Completed</Badge>
              )}
            </div>
          </div>

          {today?.check_in && (
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs text-indigo-200">Check In</p>
                <p className="font-semibold">{formatDateTime(today.check_in)}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs text-indigo-200">Check Out</p>
                <p className="font-semibold">{today.check_out ? formatDateTime(today.check_out) : "—"}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs text-indigo-200">Breaks</p>
                <p className="font-semibold">{fmtHours(today.break_seconds || 0)}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs text-indigo-200">Worked</p>
                <p className="font-semibold">{today.work_seconds ? fmtHours(today.work_seconds) : "—"}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[200px]">
                <Input type="month" label="Month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </div>
              <div className="min-w-[240px]">
                <Select label="Employee" value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}
                  options={[{ value: "", label: "All employees" }, ...employees.map((e) => ({ value: e.id, label: e.full_name }))]} />
              </div>
              <Button variant="outline" onClick={exportCSV} disabled={!records.length}>
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {summary && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card><CardContent className="p-6 text-center">
            <p className="text-sm text-gray-500">Present Days</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{summary.present}</p>
          </CardContent></Card>
          <Card><CardContent className="p-6 text-center">
            <p className="text-sm text-gray-500">Absent</p>
            <p className="mt-1 text-3xl font-bold text-amber-600">{summary.absent}</p>
          </CardContent></Card>
          <Card><CardContent className="p-6 text-center">
            <p className="text-sm text-gray-500">Late Days</p>
            <p className="mt-1 text-3xl font-bold text-red-600">{summary.lateDays}</p>
          </CardContent></Card>
          <Card><CardContent className="p-6 text-center">
            <p className="text-sm text-gray-500">Hours This Month</p>
            <p className="mt-1 text-3xl font-bold text-indigo-600">{summary.totalHours}</p>
            <p className="text-xs text-gray-400">avg {summary.avgHours}h/day</p>
          </CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-indigo-500" />
            <CardTitle>History</CardTitle>
          </div>
          <span className="text-sm text-gray-400">{month}</span>
        </CardHeader>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <div className="py-10">
              <EmptyState
                icon={<Timer className="h-12 w-12" />}
                title="No attendance records"
                description={isAdmin ? "No records for the selected period." : "Check in to create your first record."}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-400 uppercase">
                    {isAdmin && <th className="px-6 py-3">Employee</th>}
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Check In</th>
                    <th className="px-6 py-3">Check Out</th>
                    <th className="px-6 py-3">Worked</th>
                    <th className="px-6 py-3">Breaks</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {isAdmin && <td className="px-6 py-3 font-medium text-gray-900">{r.employee?.full_name || "Unknown"}</td>}
                      <td className="px-6 py-3 text-gray-600">{(r.date || "").slice(0, 10)}</td>
                      <td className="px-6 py-3 text-gray-600">{r.check_in ? formatDateTime(r.check_in) : "—"}</td>
                      <td className="px-6 py-3 text-gray-600">{r.check_out ? formatDateTime(r.check_out) : "—"}</td>
                      <td className="px-6 py-3 text-gray-600">{r.check_out ? fmtHours(r.work_seconds) : "—"}</td>
                      <td className="px-6 py-3 text-gray-600">{fmtHours(r.break_seconds || 0)}</td>
                      <td className="px-6 py-3">
                        {!r.check_in ? (
                          <Badge variant="danger">Absent</Badge>
                        ) : r.is_late ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                            Late ({r.late_minutes} min)
                          </span>
                        ) : (
                          <Badge variant="success">Present</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {message && <p className="mt-4 text-sm text-red-600">{message}</p>}
    </AppLayout>
  );
}