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
import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { Employee } from "@/types";
import { useUser } from "@/lib/use-user";

export default function EmployeesPage() {
  const { user } = useUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmp, setNewEmp] = useState({ full_name: "", email: "", job_title: "", department: "", manager: "", joining_date: "" });

  useEffect(() => {
    fetch("/api/employees")
      .then(res => res.json())
      .then(emps => { setEmployees(Array.isArray(emps) ? emps : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const depts = [...new Set(employees.map(e => e.department))];
  const filtered = employees.filter(e => {
    const matchSearch = !search || e.full_name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (!deptFilter || e.department === deptFilter);
  });

  const handleAdd = async () => {
    if (!newEmp.full_name || !newEmp.email || !newEmp.joining_date) return;
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newEmp),
    });
    const created = await res.json();
    setEmployees(prev => [...prev, created]);
    setShowAdd(false);
    setNewEmp({ full_name: "", email: "", job_title: "", department: "", manager: "", joining_date: "" });
  };

  if (loading) return <AppLayout><LoadingSpinner /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="mt-1 text-sm text-gray-500">Manage and view employee onboarding</p>
        </div>
        {(user?.role === "admin" || user?.role === "hr") && (
          <Button onClick={() => setShowAdd(true)}><Plus className="mr-2 h-4 w-4" />Add Employee</Button>
        )}
      </div>

      {employees.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No employees yet"
          description="Add your first employee to get started."
          action={<Button onClick={() => setShowAdd(true)}><Plus className="mr-2 h-4 w-4" />Add Employee</Button>}
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
            <p className="mt-1 text-sm text-gray-500">Fill in the details to create a new employee</p>
            <div className="mt-4 space-y-3">
              <Input label="Full Name" value={newEmp.full_name} onChange={e => setNewEmp({...newEmp, full_name: e.target.value})} />
              <Input label="Email" type="email" value={newEmp.email} onChange={e => setNewEmp({...newEmp, email: e.target.value})} />
              <Input label="Job Title" value={newEmp.job_title} onChange={e => setNewEmp({...newEmp, job_title: e.target.value})} />
              <Select label="Department" value={newEmp.department} onChange={e => setNewEmp({...newEmp, department: e.target.value})}
                options={[{ value: "", label: "Select department" }, ...depts.map(d => ({ value: d, label: d }))]} />
              <Input label="Manager" value={newEmp.manager} onChange={e => setNewEmp({...newEmp, manager: e.target.value})} />
              <Input label="Joining Date" type="date" value={newEmp.joining_date} onChange={e => setNewEmp({...newEmp, joining_date: e.target.value})} />
            </div>
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
