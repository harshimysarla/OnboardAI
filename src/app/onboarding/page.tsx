"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading";
import { Progress } from "@/components/ui/progress";
import { Employee, EmployeeTask } from "@/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { CheckCircle, Clock, ClipboardList, Calendar, ChevronDown, ChevronRight } from "lucide-react";

export default function OnboardingPage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = localStorage.getItem("onboardai_user");
    if (stored) try {
      const u = JSON.parse(stored);
      loadEmployeeData(u.id);
    } catch {}
    setLoading(false);
  }, []);

  const loadEmployeeData = async (empId: string) => {
    const [empRes, tasksRes] = await Promise.all([
      fetch("/api/employees?id=" + empId),
      fetch("/api/tasks?employeeId=" + empId),
    ]);
    const emp = await empRes.json();
    if (emp) {
      setEmployee(emp);
      const empTasks = await tasksRes.json();
      setTasks(Array.isArray(empTasks) ? empTasks : []);
    }
  };

  const handleComplete = async (taskId: string) => {
    if (!employee) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: employee.id, task_id: taskId }),
    });
    await loadEmployeeData(employee.id);
  };

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  if (!employee) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <ClipboardList className="h-16 w-16 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">No Onboarding Plan</h2>
          <p className="mt-2 text-sm text-gray-500">You don&apos;t have an onboarding plan yet.</p>
        </div>
      </AppLayout>
    );
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const categories = [
    { key: "day1", label: "Day 1", icon: "01" },
    { key: "first_week", label: "First Week", icon: "07" },
    { key: "first_month", label: "First Month", icon: "30" },
  ];

  const getTasksByCategory = (category: string) => tasks.filter(t => t.category === category);

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Onboarding Plan</h1>
        <p className="mt-1 text-sm text-gray-500">Track and complete your onboarding tasks</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-gray-500">Progress</p>
            <p className="mt-1 text-3xl font-bold text-indigo-600">{progress}%</p>
            <Progress value={progress} className="mt-3" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-gray-500">Completed</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{completedTasks}</p>
            <p className="text-xs text-gray-400">of {totalTasks} tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="mt-1 text-3xl font-bold text-amber-600">{totalTasks - completedTasks}</p>
            <p className="text-xs text-gray-400">tasks remaining</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-gray-500">Role</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{employee.job_title}</p>
            <p className="text-xs text-gray-400">{employee.department}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {categories.map(cat => {
          const catTasks = getTasksByCategory(cat.key);
          if (catTasks.length === 0) return null;
          const catCompleted = catTasks.filter(t => t.completed).length;
          const isExpanded = expanded[cat.key] !== false;

          return (
            <Card key={cat.key}>
              <button
                className="w-full"
                onClick={() => setExpanded(prev => ({ ...prev, [cat.key]: !prev[cat.key] }))}
              >
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-sm font-bold text-indigo-700">
                      {cat.icon}
                    </div>
                    <div className="text-left">
                      <CardTitle>{cat.label}</CardTitle>
                      <p className="text-sm text-gray-500">{catCompleted}/{catTasks.length} completed</p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                </CardHeader>
              </button>
              {isExpanded && (
                <CardContent className="p-0">
                  <div className="divide-y">
                    {catTasks.map(task => {
                      const isOverdue = !task.completed && new Date(task.due_date) < new Date();
                      return (
                        <div key={task.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                          <div className="flex items-start gap-3 flex-1">
                            {task.completed ? (
                              <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5" />
                            ) : isOverdue ? (
                              <Clock className="h-5 w-5 text-red-500 mt-0.5" />
                            ) : (
                              <ClipboardList className="h-5 w-5 text-gray-400 mt-0.5" />
                            )}
                            <div>
                              <p className={"text-sm " + (task.completed ? "text-gray-400 line-through" : "text-gray-900")}>{task.title}</p>
                              <p className="text-xs text-gray-500">{task.description}</p>
                              <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                                <Calendar className="h-3 w-3" /> Due: {formatDate(task.due_date)}
                                {task.mandatory && <Badge variant="warning">Required</Badge>}
                                {task.completed && task.completed_at && <span>Done {formatDateTime(task.completed_at)}</span>}
                              </div>
                            </div>
                          </div>
                          {!task.completed && (
                            <Button size="sm" variant="outline" onClick={() => handleComplete(task.id)}>Complete</Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}
