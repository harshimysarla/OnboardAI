"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading";
import { Progress } from "@/components/ui/progress";
import { calculateRiskAssessment } from "@/lib/risk-engine";
import { getRiskColor, getRiskDot, formatDate, formatDateTime } from "@/lib/utils";
import { Employee, EmployeeTask } from "@/types";
import { ArrowLeft, Calendar, CheckCircle, Clock, AlertTriangle, ClipboardList, MessageSquare } from "lucide-react";
import { useUser } from "@/lib/use-user";
import Link from "next/link";

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [unresolvedCount, setUnresolvedCount] = useState(0);

  const employeeId = params.id as string;

  const loadData = async () => {
    setLoading(true);
    const [empRes, tasksRes, reqsRes] = await Promise.all([
      fetch("/api/employees?id=" + employeeId),
      fetch("/api/tasks?employeeId=" + employeeId),
      fetch("/api/requests"),
    ]);
    const emp: Record<string, unknown> = await empRes.json();
    const empTasks: unknown = await tasksRes.json();
    const allReqs: unknown = await reqsRes.json();
    const requests = (Array.isArray(allReqs) ? allReqs : []) as Record<string, unknown>[];

    if (emp && employeeId) {
      setEmployee(emp as unknown as Employee);
      setTasks(Array.isArray(empTasks) ? empTasks as unknown as EmployeeTask[] : []);
      setUnresolvedCount(requests.filter(r => r.employee_id === employeeId && r.status !== "Resolved").length);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!employeeId) return;
    loadData(); // eslint-disable-line react-hooks/set-state-in-effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const handleCompleteTask = async (taskId: string) => {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: employeeId, task_id: taskId }),
    });
    await loadData();
  };

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;
  if (!employee) return <AppLayout><div className="text-center py-20"><p className="text-gray-500">Employee not found</p></div></AppLayout>;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const pendingTasks = tasks.filter(t => !t.completed);
  const overdueTasks = tasks.filter(t => !t.completed && new Date(t.due_date) < new Date());
  const riskAssessment = calculateRiskAssessment(employee, tasks, unresolvedCount);

  return (
    <AppLayout>
      <div className="mb-6">
        <button onClick={() => router.back()} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
              {employee.full_name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{employee.full_name}</h1>
              <p className="text-sm text-gray-500">{employee.job_title} &middot; {employee.department}</p>
              <p className="text-xs text-gray-400">{employee.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium " + getRiskColor(riskAssessment.risk_level)}>
              <span className={"h-2 w-2 rounded-full " + getRiskDot(riskAssessment.risk_level)} />
              {riskAssessment.risk_level === "green" ? "On Track" : riskAssessment.risk_level === "yellow" ? "Needs Attention" : "High Risk"}
            </span>
            {user?.role === "employee" && (
              <Link href="/assistant">
                <Button><MessageSquare className="mr-2 h-4 w-4" />Ask OnboardAI</Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={employee.progress} size="lg" className="flex-1" />
              <span className="text-2xl font-bold text-indigo-600">{employee.progress}%</span>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Completed Tasks</span>
                <span className="font-medium">{completedTasks}/{totalTasks}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Overdue Tasks</span>
                <span className="font-medium text-red-600">{overdueTasks.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Information</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Manager</span><span>{employee.manager || "Not assigned"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Joining Date</span><span>{formatDate(employee.joining_date)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Department</span><span>{employee.department}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Role</span><span>{employee.job_title}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Risk Assessment</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm text-gray-500">Risk Score:</span>
              <span className={"text-lg font-bold " + (riskAssessment.score < 30 ? "text-emerald-600" : riskAssessment.score < 60 ? "text-amber-600" : "text-red-600")}>
                {riskAssessment.score}/100
              </span>
            </div>
            {riskAssessment.factors.length > 0 && (
              <div className="space-y-2 mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase">Risk Factors</p>
                {riskAssessment.factors.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <AlertTriangle className={"h-3 w-3 mt-0.5 " + (f.impact === "high" ? "text-red-500" : "text-amber-500")} />
                    <span className="text-gray-600">{f.details}</span>
                  </div>
                ))}
              </div>
            )}
            {riskAssessment.recommendation && (
              <div className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">
                <p className="text-xs font-medium text-indigo-600 mb-1">Recommended Action</p>
                {riskAssessment.recommendation}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Onboarding Tasks ({totalTasks})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {[
              { key: "overdue", label: "Overdue", tasks: overdueTasks, color: "red" },
              { key: "pending", label: "Pending", tasks: pendingTasks.filter(t => !overdueTasks.find(o => o.id === t.id)), color: "amber" },
              { key: "completed", label: "Completed", tasks: tasks.filter(t => t.completed), color: "emerald" },
            ].filter(s => s.tasks.length > 0).map(section => (
              <div key={section.key}>
                <div className="px-6 py-3 bg-gray-50">
                  <span className={"text-sm font-medium text-" + section.color + "-700"}>{section.label} ({section.tasks.length})</span>
                </div>
                {section.tasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                    <div className="flex items-start gap-3 flex-1">
                      {task.completed ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5" />
                      ) : new Date(task.due_date) < new Date() ? (
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
                          {task.completed && task.completed_at && <span>Completed {formatDateTime(task.completed_at)}</span>}
                        </div>
                      </div>
                    </div>
                    {!task.completed && (
                      <Button size="sm" variant="outline" onClick={() => handleCompleteTask(task.id)}>Mark Complete</Button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
