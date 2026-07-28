"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import { Employee, SupportRequest } from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, PieLabelRenderProps
} from "recharts";
import { BarChart3 } from "lucide-react";

const PIE_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

interface AnalyticsData {
  avgCompletion: number;
  completionByDepartment: { department: string; completion: number }[];
  riskDistribution: { level: string; count: number }[];
  overdueTasks: number;
  requestCategories: { category: string; count: number }[];
  avgOnboardingTime: number;
  trends: { month: string; progress: number }[];
}

function computeAnalytics(employees: Employee[], requests: SupportRequest[]): AnalyticsData {
  const total = employees.length || 1;
  const avgCompletion = Math.round(employees.reduce((s, e) => s + (e.progress || 0), 0) / total);
  const deptMap = new Map<string, number[]>();
  employees.forEach(e => {
    if (!deptMap.has(e.department)) deptMap.set(e.department, []);
    deptMap.get(e.department)!.push(e.progress || 0);
  });
  const completionByDepartment = Array.from(deptMap.entries()).map(([dept, progs]) => ({
    department: dept,
    completion: Math.round(progs.reduce((a, b) => a + b, 0) / progs.length),
  }));
  const riskDistribution = [
    { level: "On Track", count: employees.filter(e => e.risk_level === "green").length },
    { level: "Needs Attention", count: employees.filter(e => e.risk_level === "yellow").length },
    { level: "High Risk", count: employees.filter(e => e.risk_level === "red").length },
  ];
  const catMap = new Map<string, number>();
  requests.forEach(r => { catMap.set(r.category, (catMap.get(r.category) || 0) + 1); });
  const requestCategories = Array.from(catMap.entries()).map(([cat, count]) => ({ category: cat, count }));
  const overdueTasks = employees.reduce((s, e) => s + Math.floor(e.progress < 50 ? 2 : 0), 0);
  return {
    avgCompletion,
    completionByDepartment,
    riskDistribution,
    overdueTasks,
    requestCategories,
    avgOnboardingTime: employees.length > 0 ? Math.round(employees.reduce((s, e) => s + Math.min((Date.now() - new Date(e.joining_date).getTime()) / (1000 * 60 * 60 * 24), 90), 0) / employees.length) : 0,
    trends: [
      { month: "Jan", progress: avgCompletion },
      { month: "Feb", progress: avgCompletion },
      { month: "Mar", progress: avgCompletion },
      { month: "Apr", progress: avgCompletion },
      { month: "May", progress: avgCompletion },
      { month: "Jun", progress: avgCompletion },
    ],
  };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/employees").then(r => r.json()),
      fetch("/api/requests").then(r => r.json()),
    ]).then(([emps, reqs]) => {
      const employees = Array.isArray(emps) ? emps : [];
      const requests = Array.isArray(reqs) ? reqs : [];
      if (employees.length > 0) {
        setData(computeAnalytics(employees, requests));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  if (!data) {
    return (
      <AppLayout>
        <EmptyState
          icon={<BarChart3 className="h-12 w-12" />}
          title="No analytics data"
          description="Add employees and track onboarding to see analytics."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Onboarding metrics and insights</p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">Avg Completion</p>
            <p className="text-2xl font-bold text-indigo-600">{data.avgCompletion}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">Overdue Tasks</p>
            <p className="text-2xl font-bold text-red-600">{data.overdueTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">Avg Onboarding Time</p>
            <p className="text-2xl font-bold text-emerald-600">{data.avgOnboardingTime}d</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">Total Departments</p>
            <p className="text-2xl font-bold text-blue-600">{data.completionByDepartment.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Completion by Department</CardTitle></CardHeader>
          <CardContent>
            {data.completionByDepartment.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.completionByDepartment}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="completion" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No department data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Risk Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data.riskDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="count" nameKey="level" label={(props: PieLabelRenderProps) => (props.name || "") + ": " + props.value}>
                  {data.riskDistribution.map((_, i: number) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Support Request Categories</CardTitle></CardHeader>
          <CardContent>
            {data.requestCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.requestCategories} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No request data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
