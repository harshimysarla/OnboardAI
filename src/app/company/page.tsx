"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading";
import { Building2, Users, Shield } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";

interface Department { id: string; name: string; employee_count?: number; }
interface RoleCount { role: string; count: number; }

export default function CompanyPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [companyName, setCompanyName] = useState("Acme Corp");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<RoleCount[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("onboardai_user");
    if (stored) try {
      const u = JSON.parse(stored);
      setUser(u);
      if (u.company_name) setCompanyName(u.company_name);
    } catch {}

    if (isSupabaseConfigured) {
      Promise.all([
        fetch("/api/auth").then(r => r.json()),
        fetch("/api/employees").then(r => r.json()),
      ]).then(([authData, emps]) => {
        if (authData?.user?.company_name) setCompanyName(authData.user.company_name);

        const employees = Array.isArray(emps) ? emps : [];
        const deptMap = new Map<string, number>();
        employees.forEach((e: any) => {
          const d = e.department || "Unassigned";
          deptMap.set(d, (deptMap.get(d) || 0) + 1);
        });
        setDepartments(Array.from(deptMap.entries()).map(([name, count]) => ({
          id: name, name, employee_count: count,
        })));

        const roleCounts: RoleCount[] = [];
        const adminCount = employees.filter((e: any) => e.job_title?.toLowerCase().includes("admin")).length;
        if (adminCount > 0) roleCounts.push({ role: "Admin", count: adminCount });
        roleCounts.push({ role: "Employee", count: employees.length });
        setRoles(roleCounts);
      }).catch(() => {});
    } else {
      setDepartments([
        { id: "eng", name: "Engineering", employee_count: 3 },
        { id: "hr", name: "HR", employee_count: 2 },
        { id: "fin", name: "Finance", employee_count: 1 },
        { id: "mkt", name: "Marketing", employee_count: 1 },
        { id: "ops", name: "Operations", employee_count: 1 },
      ]);
      setRoles([
        { role: "Admin", count: 1 },
        { role: "Employee", count: 8 },
      ]);
    }
    setLoading(false);
  }, []);

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Company Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your company profile and settings</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              <CardTitle>Company Profile</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Company Name" value={companyName} disabled />
            <p className="text-xs text-gray-400">Contact support to update company profile.</p>
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
            <div className="space-y-2">
              {departments.map((dept) => (
                <div key={dept.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span>{dept.name}</span>
                  <span className="text-xs text-gray-400">{dept.employee_count} employees</span>
                </div>
              ))}
            </div>
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
            <div className="space-y-2">
              {roles.map((r) => (
                <div key={r.role} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span>{r.role}</span>
                  <span className="text-xs text-gray-400">{r.count} users</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
