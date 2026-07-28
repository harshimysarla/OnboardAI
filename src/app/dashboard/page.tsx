"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { getRiskColor, getRiskDot, getStatusColor, formatDate } from "@/lib/utils";
import { calculateRiskAssessment } from "@/lib/risk-engine";
import { RiskAssessment, Employee, SupportRequest, EmployeeTask } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, TrendingUp, Clock, AlertTriangle, Activity, HelpCircle, Lightbulb } from "lucide-react";
import Link from "next/link";

const PIE_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

interface DashboardPageUser { name: string; role: string; id: string; email: string; }

interface DashboardStats {
  totalEmployees: number; avgProgress: number; onTrack: number;
  needsAttention: number; highRisk: number; openRequests: number;
}

function computeStats(employees: Employee[], requests: SupportRequest[], empId?: string): DashboardStats {
  const targetEmps = empId ? employees.filter(e => e.id === empId) : employees;
  const total = targetEmps.length || 1;
  return {
    totalEmployees: total,
    avgProgress: Math.round(targetEmps.reduce((s, e) => s + (e.progress || 0), 0) / total),
    onTrack: targetEmps.filter(e => e.risk_level === "green").length,
    needsAttention: targetEmps.filter(e => e.risk_level === "yellow").length,
    highRisk: targetEmps.filter(e => e.risk_level === "red").length,
    openRequests: requests.filter(r => {
      if (empId && r.employee_id !== empId) return false;
      return r.status !== "Resolved";
    }).length,
  };
}

export default function DashboardPage() {
  const [user, setUser] = useState<DashboardPageUser | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("onboardai_user");
    if (!stored) { setLoading(false); return; }

    let u: DashboardPageUser;
    try { u = JSON.parse(stored); } catch { setLoading(false); return; }
    setUser(u);

    if (u.role === "admin") {
      loadAdminData();
    } else {
      loadEmployeeData(u.id);
    }
  }, []);

  const loadAdminData = async () => {
    const [empsRes, reqsRes] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/requests"),
    ]);
    const emps: Employee[] = await empsRes.json();
    const reqs: SupportRequest[] = await reqsRes.json();
    const employees = Array.isArray(emps) ? emps : [];
    const requests = Array.isArray(reqs) ? reqs : [];

    setEmployees(employees);
    setRequests(requests);
    setStats(computeStats(employees, requests));

    // Fetch tasks for at-risk employees and compute risk assessments
    const flaggedEmps = employees.filter(e => e.risk_level !== "green" || (e.progress || 0) < 50);
    const tasksResults = await Promise.all(
      flaggedEmps.map(emp =>
        fetch("/api/tasks?employeeId=" + emp.id).then(r => r.json()).catch(() => [])
      )
    );
    const assessments = flaggedEmps.map((emp, i) => {
      const empTasks: EmployeeTask[] = Array.isArray(tasksResults[i]) ? tasksResults[i] : [];
      const unresolved = requests.filter(r => r.employee_id === emp.id && r.status !== "Resolved").length;
      return calculateRiskAssessment(emp, empTasks, unresolved);
    });
    setRiskAssessments(assessments);
    setLoading(false);
  };

  const loadEmployeeData = async (empId: string) => {
    const [empsRes, reqsRes, tasksRes] = await Promise.all([
      fetch("/api/employees?id=" + empId),
      fetch("/api/requests"),
      fetch("/api/tasks?employeeId=" + empId),
    ]);
    const emp = await empsRes.json();
    const reqs: SupportRequest[] = await reqsRes.json();
    const empTasks: EmployeeTask[] = await tasksRes.json();

    if (emp) {
      const employees = [emp];
      const requests = (Array.isArray(reqs) ? reqs : []).filter(r => r.employee_id === empId);

      setEmployees(employees);
      setRequests(requests);
      setStats(computeStats(employees, requests, empId));

      const assessment = calculateRiskAssessment(emp, Array.isArray(empTasks) ? empTasks : []);
      setRiskAssessments([assessment]);
    }
    setLoading(false);
  };

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  const isAdmin = user?.role === "admin";
  const riskDistribution = stats ? [
    { level: "On Track", count: stats.onTrack },
    { level: "Needs Attention", count: stats.needsAttention },
    { level: "High Risk", count: stats.highRisk },
  ] : [];

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {isAdmin ? "HR Dashboard" : "Welcome, " + (user?.name || "Employee")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isAdmin ? "Overview of employee onboarding status" : "Your onboarding progress at a glance"}
        </p>
      </div>

      {stats && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard title="Employees" value={stats.totalEmployees} icon={<Users className="h-6 w-6" />} color="indigo" />
          <KpiCard title="Avg Progress" value={stats.avgProgress + "%"} icon={<TrendingUp className="h-6 w-6" />} color="blue" />
          <KpiCard title="On Track" value={stats.onTrack} icon={<Activity className="h-6 w-6" />} color="emerald" />
          <KpiCard title="Needs Attention" value={stats.needsAttention} icon={<Clock className="h-6 w-6" />} color="amber" />
          <KpiCard title="High Risk" value={stats.highRisk} icon={<AlertTriangle className="h-6 w-6" />} color="red" />
          <KpiCard title="Open Requests" value={stats.openRequests} icon={<HelpCircle className="h-6 w-6" />} color="indigo" />
        </div>
      )}

      {isAdmin && (
        <>
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
                    <Pie data={riskDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="count" nameKey="level" label={({ name, value }: any) => String(name) + ": " + value}>
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
                            <span className={"font-medium text-gray-900 " + (ra.risk_level === "red" ? "text-red-800" : "text-amber-800")}>{emp?.full_name || "Unknown"}</span>
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
                            {ra.factors.map((f: { impact: string; details: string }, i: number) => (
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
                  {employees.map((emp: Employee) => (
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

      {!isAdmin && employees[0] && (
        <div className="mt-8">
          <Card>
            <CardHeader><CardTitle>Your Onboarding Progress</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Progress value={employees[0].progress} className="flex-1" size="lg" />
                <span className="text-2xl font-bold text-indigo-600">{employees[0].progress}%</span>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-emerald-50 p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{employees[0].progress >= 80 ? "On Track" : "In Progress"}</p>
                  <p className="text-sm text-emerald-700">Status</p>
                </div>
                <div className="rounded-lg bg-indigo-50 p-4 text-center">
                  <p className="text-2xl font-bold text-indigo-600">{employees[0].job_title}</p>
                  <p className="text-sm text-indigo-700">Role</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">{employees[0].department}</p>
                  <p className="text-sm text-amber-700">Department</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="mt-6 flex gap-4">
            <Link href="/onboarding"><Button>View Onboarding Plan</Button></Link>
            <Link href="/assistant"><Button variant="outline">Ask OnboardAI</Button></Link>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
