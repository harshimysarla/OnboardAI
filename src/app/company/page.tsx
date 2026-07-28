"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading";
import { Building2, Users, Shield } from "lucide-react";
import { useUser } from "@/lib/use-user";

interface Department { id: string; name: string; employee_count?: number; }
interface RoleCount { role: string; count: number; }

export default function CompanyPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<RoleCount[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      fetch("/api/employees").then(r => r.json()),
    ]).then(([emps]) => {
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
      setLoading(false);
    }).catch(() => {
      setError("Failed to load company data");
      setLoading(false);
    });
  }, [user]);

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Company</h1>
        <p className="mt-1 text-sm text-gray-500">Your organization overview</p>
      </div>

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
    </AppLayout>
  );
}
