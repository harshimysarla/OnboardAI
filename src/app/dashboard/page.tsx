"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { getRiskColor, getRiskDot, getStatusColor, formatDate } from "@/lib/utils";
import { calculateRiskAssessment } from "@/lib/risk-engine";
import { Employee, SupportRequest, EmployeeTask, RiskAssessment } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, PieLabelRenderProps } from "recharts";
import { Users, TrendingUp, Clock, AlertTriangle, Activity, HelpCircle, Lightbulb, LayoutDashboard, Calendar, Target, Briefcase, ClipboardList, FileText, Zap, CheckCircle2 } from "lucide-react";
import { useUser } from "@/lib/use-user";
import Link from "next/link";

const PIE_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

interface DashboardStats {
  totalEmployees: number;
  avgProgress: number;
  onTrack: number;
  needsAttention: number;
  highRisk: number;
  openRequests: number;
}

interface DashTask {
  id: string;
  title: string;
  description: string;
  category: string;
  mandatory: boolean;
  completed: boolean;
  due_date: string;
  completed_at?: string;
}

interface DashData {
  employee: Employee & { department: string };
  company: { name: string; office_info: Record<string, string> };
  tasks: DashTask[];
  taskSummary: { total: number; completed: number; overdue: number; pending: number; recent: DashTask[] };
  activities: { id: string; action: string; details: string; created_at: string }[];
  requests: SupportRequest[];
  policies: { id: string; title: string; category: string; created_at: string }[];
}

function computeStats(employees: Employee[], requests: SupportRequest[], empId?: string): DashboardStats {
  const targetEmps = empId ? employees.filter((e) => e.id === empId) : employees;
  const total = targetEmps.length || 1;
  return {
    totalEmployees: targetEmps.length,
    avgProgress: Math.round(targetEmps.reduce((s, e) => s + (e.progress || 0), 0) / total),
    onTrack: targetEmps.filter((e) => e.risk_level === "green").length,
    needsAttention: targetEmps.filter((e) => e.risk_level === "yellow").length,
    highRisk: targetEmps.filter((e) => e.risk_level === "red").length,
    openRequests: requests.filter((r) => {
      if (empId && r.employee_id !== empId) return false;
      return r.status !== "Resolved";
    }).length,
  };
}

export default function DashboardPage() {
  const { user } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([]);
  const [dash, setDash] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAdminData = async () => {
    const [empsRes, reqsRes] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/requests"),
    ]);
    const emps: Employee[] = await empsRes.json();
    const reqs: SupportRequest[] = await reqsRes.json();
    const employeesList = Array.isArray(emps) ? emps : [];
    const requestsList = Array.isArray(reqs) ? reqs : [];

    setEmployees(employeesList);
    setRequests(requestsList);
    setStats(computeStats(employeesList, requestsList));

    const flaggedEmps = employeesList.filter((e) => e.risk_level !== "green" || (e.progress || 0) < 50);
    const tasksResults = await Promise.all(
      flaggedEmps.map((emp) =>
        fetch("/api/tasks?employeeId=" + emp.id).then((r) => r.json()).catch(() => [])
      )
    );
    const assessments = flaggedEmps.map((emp, i) => {
      const empTasks: EmployeeTask[] = Array.isArray(tasksResults[i]) ? tasksResults[i] : [];
      const unresolved = requestsList.filter((r) => r.employee_id === emp.id && r.status !== "Resolved").length;
      return calculateRiskAssessment(emp, empTasks, unresolved);
    });
    setRiskAssessments(assessments);
    setLoading(false);
  };

  const loadEmployeeData = async () => {
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      if (data && data.employee) {
        setDash(data);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    if (user.role === "admin" || user.role === "hr") {
      loadAdminData(); // eslint-disable-line react-hooks/set-state-in-effect
    } else {
      loadEmployeeData();
    }
  }, [user]);

  if (!user || loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  const isAdmin = user.role === "admin" || user.role === "hr";
  const riskDistribution = stats && employees.length > 0 ? [
    { level: "On Track", count: stats.onTrack },
    { level: "Needs Attention", count: stats.needsAttention },
    { level: "High Risk", count: stats.highRisk },
  ] : [];

  // Employee portal widgets
  const handleCompleteTask = async (taskId: string) => {
    if (!dash) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: dash.employee.id, task_id: taskId }),
    });
    loadEmployeeData();
  };

  const employeeRisk = dash ? calculateRiskAssessment(dash.employee, dash.tasks) : null;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {isAdmin ? "Dashboard" : "Welcome, " + (user.name || "Employee")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isAdmin ? "Overview of employee onboarding status" : "Your workspace at a glance"}
        </p>
      </div>

      {!isAdmin && !dash && (
        <EmptyState
          icon={<LayoutDashboard className="h-12 w-12" />}
          title="No data yet"
          description="Your workspace data will appear here once you&apos;re set up."
        />
      )}

      {/* ─────────────── EMPLOYEE PORTAL ─────────────── */}
      {!isAdmin && dash && (
        <>
          {/* Welcome card */}
          <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 text-white shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-indigo-200">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
                <h2 className="mt-1 text-2xl font-bold">Welcome back, {dash.employee.full_name.split(" ")[0]}!</h2>
                <p className="mt-1 text-sm text-indigo-100">
                  {dash.employee.job_title} · {dash.employee.department || "Unassigned"} · {dash.company.name}
                </p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold">
                {dash.employee.full_name.charAt(0)}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {/* Profile summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-indigo-500" /><CardTitle>Profile</CardTitle></div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Role</span><span className="font-medium">{dash.employee.job_title}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Department</span><span className="font-medium">{dash.employee.department || "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Manager</span><span className="font-medium">{dash.employee.manager || "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Joined</span><span className="font-medium">{formatDate(dash.employee.joining_date)}</span></div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Office</span>
                  <span className="font-medium">{dash.company.office_info?.city || "—"}{dash.company.office_info?.country ? ", " + dash.company.office_info.country : ""}</span>
                </div>
              </CardContent>
            </Card>

            {/* Onboarding progress */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><Target className="h-5 w-5 text-emerald-500" /><CardTitle>Onboarding</CardTitle></div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20">
                    <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                      <circle cx="40" cy="40" r="34" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray={`${2 * Math.PI * 34}`} strokeDashoffset={`${2 * Math.PI * 34 * (1 - (dash.employee.progress || 0) / 100)}`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-800">{dash.employee.progress}%</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-500">{dash.taskSummary.completed} of {dash.taskSummary.total} tasks done</p>
                    <p className="text-amber-600">{dash.taskSummary.overdue} overdue</p>
                    <p className="text-gray-400">{dash.taskSummary.pending} pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk status */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /><CardTitle>Risk Status</CardTitle></div>
              </CardHeader>
              <CardContent>
                <span className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium " + getRiskColor(dash.employee.risk_level)}>
                  <span className={"h-2 w-2 rounded-full " + getRiskDot(dash.employee.risk_level)} />
                  {dash.employee.risk_level === "green" ? "On Track" : dash.employee.risk_level === "yellow" ? "Needs Attention" : "High Risk"}
                </span>
                <div className="mt-3 space-y-1 text-xs text-gray-600">
                  {employeeRisk?.factors?.slice(0, 3).map((f, i) => (
                    <p key={i} className="flex items-start gap-1"><AlertTriangle className="mt-0.5 h-3 w-3 text-amber-500" />{f.details}</p>
                  ))}
                  {(!employeeRisk?.factors || employeeRisk.factors.length === 0) && <p>Everything looks good. Keep it up!</p>}
                </div>
              </CardContent>
            </Card>

            {/* Quick actions */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><Zap className="h-5 w-5 text-indigo-500" /><CardTitle>Quick Actions</CardTitle></div>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Link href="/onboarding"><Button variant="outline" size="sm" className="w-full justify-start"><ClipboardList className="mr-2 h-4 w-4" />My Onboarding Plan</Button></Link>
                <Link href="/requests"><Button variant="outline" size="sm" className="w-full justify-start"><HelpCircle className="mr-2 h-4 w-4" />Submit a Request</Button></Link>
                <Link href="/assistant"><Button variant="outline" size="sm" className="w-full justify-start"><LayoutDashboard className="mr-2 h-4 w-4" />Ask OnboardAI</Button></Link>
                <Link href="/policies"><Button variant="outline" size="sm" className="w-full justify-start"><FileText className="mr-2 h-4 w-4" />Company Policies</Button></Link>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* Tasks today & upcoming */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><Calendar className="h-5 w-5 text-indigo-500" /><CardTitle>Tasks Due</CardTitle></div>
              </CardHeader>
              <CardContent className="p-0">
                {dash.taskSummary.recent.length === 0 ? (
                  <p className="px-6 pb-4 text-sm text-gray-500">No pending tasks. You&apos;re all caught up!</p>
                ) : (
                  <div className="divide-y">
                    {dash.taskSummary.recent.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-3 px-6 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{t.title}</p>
                          <p className="text-xs text-gray-500">
                            {t.due_date ? (new Date(t.due_date) < new Date() ? <span className="text-red-500">Overdue · </span> : "") + "Due " + formatDate(t.due_date) : "No due date"}
                            {t.mandatory && <span className="ml-2 text-amber-600">Required</span>}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleCompleteTask(t.id)}><CheckCircle2 className="mr-1 h-4 w-4" />Complete</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent activity */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-indigo-500" /><CardTitle>Recent Activity</CardTitle></div>
              </CardHeader>
              <CardContent className="p-0">
                {dash.activities.length === 0 ? (
                  <p className="px-6 pb-4 text-sm text-gray-500">No activity yet.</p>
                ) : (
                  <div className="divide-y">
                    {dash.activities.slice(0, 6).map((a) => (
                      <div key={a.id} className="px-6 py-3">
                        <p className="text-sm font-medium text-gray-900">{a.action}</p>
                        {a.details && <p className="text-xs text-gray-500">{a.details}</p>}
                        <p className="mt-0.5 text-xs text-gray-400">{formatDate(a.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* My requests */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><HelpCircle className="h-5 w-5 text-indigo-500" /><CardTitle>My Requests</CardTitle></div>
              </CardHeader>
              <CardContent className="p-0">
                {dash.requests.length === 0 ? (
                  <p className="px-6 pb-4 text-sm text-gray-500">No support requests yet.</p>
                ) : (
                  <div className="divide-y">
                    {dash.requests.slice(0, 4).map((r) => (
                      <div key={r.id} className="px-6 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-gray-900">{r.type}</p>
                          <span className={"inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " + getStatusColor(r.status)}>{r.status}</span>
                        </div>
                        <p className="text-xs text-gray-500">{r.category} · {r.priority}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent policies */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-indigo-500" /><CardTitle>Recent Policies</CardTitle></div>
              </CardHeader>
              <CardContent className="p-0">
                {dash.policies.length === 0 ? (
                  <p className="px-6 pb-4 text-sm text-gray-500">No policies published yet.</p>
                ) : (
                  <div className="divide-y">
                    {dash.policies.map((p) => (
                      <div key={p.id} className="px-6 py-3">
                        <p className="text-sm font-medium text-gray-900">{p.title}</p>
                        <p className="text-xs text-gray-500">{p.category}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* KPI mini row */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><Target className="h-5 w-5 text-indigo-500" /><CardTitle>At a Glance</CardTitle></div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-indigo-50 p-3 text-center">
                  <p className="text-2xl font-bold text-indigo-600">{dash.taskSummary.total}</p>
                  <p className="text-xs text-indigo-700">Total Tasks</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{dash.taskSummary.completed}</p>
                  <p className="text-xs text-emerald-700">Completed</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{dash.taskSummary.overdue}</p>
                  <p className="text-xs text-amber-700">Overdue</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{dash.requests.filter((r) => r.status !== "Resolved").length}</p>
                  <p className="text-xs text-blue-700">Open Requests</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ─────────────── ADMIN / HR DASHBOARD ─────────────── */}
      {isAdmin && !stats && (
        <EmptyState
          icon={<LayoutDashboard className="h-12 w-12" />}
          title="No data yet"
          description="Your organization doesn't have any data yet. Start by adding employees."
        />
      )}

      {isAdmin && stats && employees.length === 0 && (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No employees"
          description="Add your first employee to start tracking onboarding."
          action={<Link href="/employees"><Button>Add Employee</Button></Link>}
        />
      )}

      {isAdmin && stats && employees.length > 0 && (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard title="Employees" value={stats.totalEmployees} icon={<Users className="h-6 w-6" />} color="indigo" />
            <KpiCard title="Avg Progress" value={stats.avgProgress + "%"} icon={<TrendingUp className="h-6 w-6" />} color="blue" />
            <KpiCard title="On Track" value={stats.onTrack} icon={<Activity className="h-6 w-6" />} color="emerald" />
            <KpiCard title="Needs Attention" value={stats.needsAttention} icon={<Clock className="h-6 w-6" />} color="amber" />
            <KpiCard title="High Risk" value={stats.highRisk} icon={<AlertTriangle className="h-6 w-6" />} color="red" />
            <KpiCard title="Open Requests" value={stats.openRequests} icon={<HelpCircle className="h-6 w-6" />} color="indigo" />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Onboarding Progress by Employee</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={employees}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="full_name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="progress" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Risk Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={riskDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="count" nameKey="label" label={(props: PieLabelRenderProps) => (props.name || "") + ": " + props.value}>
                      {riskDistribution.map((_, i: number) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-8">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                <CardTitle>AI Insights & Recommendations</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {riskAssessments.length === 0 ? (
                <p className="text-sm text-gray-500">All employees are on track. No recommendations at this time.</p>
              ) : (
                <div className="space-y-4">
                  {riskAssessments.slice(0, 4).map((ra: RiskAssessment) => {
                    const emp = employees.find((e: Employee) => e.id === ra.employee_id);
                    return (
                      <div key={ra.employee_id} className={"rounded-lg border-l-4 p-4 " + (ra.risk_level === "red" ? "border-l-red-500 bg-red-50" : "border-l-amber-500 bg-amber-50")}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={"font-medium " + (ra.risk_level === "red" ? "text-red-800" : "text-amber-800")}>{emp?.full_name || "Unknown"}</span>
                            <span className={"text-xs font-medium " + (ra.risk_level === "red" ? "text-red-600" : "text-amber-600")}>
                              {ra.risk_level === "red" ? "HIGH RISK" : "NEEDS ATTENTION"}
                            </span>
                          </div>
                          <Link href={"/employees/" + ra.employee_id}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <span className="text-gray-500">Progress:</span>
                          <Progress value={emp?.progress || 0} className="w-24" />
                          <span className="text-xs text-gray-500">{emp?.progress || 0}%</span>
                        </div>
                        {ra.factors && ra.factors.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {ra.factors.map((f, i) => (
                              <p key={i} className="flex items-center gap-1 text-xs text-gray-600">
                                <AlertTriangle className={"h-3 w-3 " + (f.impact === "high" ? "text-red-500" : "text-amber-500")} />
                                {f.details}
                              </p>
                            ))}
                          </div>
                        )}
                        {ra.recommendation && (
                          <div className="mt-2 rounded bg-white/50 p-2 text-xs text-gray-700">
                            <span className="font-medium">Recommendation: </span>{ra.recommendation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {riskAssessments.length > 4 && (
                    <Link href="/employees" className="block text-center text-sm font-medium text-indigo-600 hover:text-indigo-800">
                      View all {riskAssessments.length} assessments
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-8">
            <CardHeader><CardTitle>Employees</CardTitle></CardHeader>
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
                  {employees.slice(0, 10).map((emp: Employee) => (
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
                        <Link href={"/employees/" + emp.id}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="mt-8">
            <CardHeader><CardTitle>Recent Support Requests</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR><TH>Employee</TH><TH>Request</TH><TH>Category</TH><TH>Priority</TH><TH>Status</TH><TH>Date</TH></TR>
                </THead>
                <TBody>
                  {requests.slice(0, 5).map((req: SupportRequest) => (
                    <TR key={req.id}>
                      <TD className="text-gray-900 font-medium">{req.employee_name}</TD>
                      <TD className="text-gray-600">{req.type}</TD>
                      <TD><Badge variant="info">{req.category}</Badge></TD>
                      <TD><Badge variant={req.priority === "Urgent" ? "danger" : req.priority === "High" ? "warning" : "default"}>{req.priority}</Badge></TD>
                      <TD><span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + getStatusColor(req.status)}>{req.status}</span></TD>
                      <TD className="text-gray-500 text-xs">{formatDate(req.created_at)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </AppLayout>
  );
}