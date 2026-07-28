import os

BASE = r"C:\wse\OnboardAI"

def write_file(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Written: {path}")

# === Dashboard ===
write_file("src/app/dashboard/page.tsx", """
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
import { demoService } from "@/lib/demo-service";
import { getRiskColor, getRiskDot, getStatusColor, formatDate } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, TrendingUp, Clock, AlertTriangle, Activity, HelpCircle } from "lucide-react";
import Link from "next/link";

const PIE_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("onboardai_user");
    if (stored) {
      const u = JSON.parse(stored);
      setUser(u);
      if (u.role === "admin") {
        loadAdminData();
      } else {
        loadEmployeeData(u.id);
      }
    }
    setLoading(false);
  }, []);

  const loadAdminData = async () => {
    const emps = await demoService.getEmployees();
    const reqs = await demoService.getSupportRequests();
    setStats(demoService.getDashboardStats());
    setEmployees(emps);
    setRequests(reqs);
  };

  const loadEmployeeData = async (empId: string) => {
    const emp = await demoService.getEmployeeById(empId);
    const reqs = await demoService.getSupportRequests();
    if (emp) {
      setStats({
        totalEmployees: 1,
        avgProgress: emp.progress,
        onTrack: emp.risk_level === "green" ? 1 : 0,
        needsAttention: emp.risk_level === "yellow" ? 1 : 0,
        highRisk: emp.risk_level === "red" ? 1 : 0,
        openRequests: reqs.filter(r => r.employee_id === empId && r.status !== "Resolved").length,
      });
      setEmployees([emp]);
    }
    setRequests(reqs.filter(r => r.employee_id === empId));
  };

  const getProgressColor = (val: number) => {
    if (val >= 80) return "emerald";
    if (val >= 50) return "blue";
    if (val >= 25) return "amber";
    return "red";
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
          {isAdmin ? "HR Dashboard" : `Welcome, ${user?.name || "Employee"}`}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isAdmin ? "Overview of employee onboarding status" : "Your onboarding progress at a glance"}
        </p>
      </div>

      {stats && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard title="Employees Onboarding" value={stats.totalEmployees} icon={<Users className="h-6 w-6" />} color="indigo" />
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
              <CardHeader><CardTitle>Onboarding Progress</CardTitle></CardHeader>
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
                    <Pie data={riskDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="count" nameKey="level" label={({ level, count }) => level + ": " + count}>
                      {riskDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Employees</CardTitle>
            </CardHeader>
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
                  {employees.map((emp) => (
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
                  {requests.slice(0, 5).map((req) => (
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

          {requests.length > 0 && (
            <Card className="mt-6">
              <CardHeader><CardTitle>Your Requests</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <THead><TR><TH>Request</TH><TH>Category</TH><TH>Status</TH><TH>Date</TH></TR></THead>
                  <TBody>
                    {requests.map((req) => (
                      <TR key={req.id}>
                        <TD className="text-gray-900">{req.type}</TD>
                        <TD><Badge variant="info">{req.category}</Badge></TD>
                        <TD><span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + getStatusColor(req.status)}>{req.status}</span></TD>
                        <TD className="text-gray-500 text-xs">{formatDate(req.created_at)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="mt-6 flex gap-4">
            <Link href="/onboarding"><Button>View Onboarding Plan</Button></Link>
            <Link href="/assistant"><Button variant="outline">Ask OnboardAI</Button></Link>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
""".strip())

print("Dashboard page written")
""".strip()