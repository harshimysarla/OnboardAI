"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, Star, CheckCircle2, AlertTriangle, TrendingUp, Clock, FileText } from "lucide-react";
import { useUser } from "@/lib/use-user";
import { formatDate, isStaffRole } from "@/lib/utils";

interface Goal {
  id: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  due_date?: string;
  assigned_by_name: string;
}

interface Review {
  id: string;
  period: string;
  rating: number;
  feedback: string;
  reviewer_name: string;
  created_at: string;
}

export default function PerformancePage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");

  const [goalForm, setGoalForm] = useState({ title: "", description: "", due_date: "" });
  const [reviewForm, setReviewForm] = useState({ period: "", rating: 3, feedback: "" });
  
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const isStaff = isStaffRole(user?.role);
  const canManage = isStaff || user?.role === "manager";

  const loadData = useCallback(async (empId?: string) => {
    setLoading(true);
    let url = "/api/performance";
    if (empId) {
      url += `?employeeId=${empId}`;
    }
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setGoals(data.goals || []);
      setReviews(data.reviews || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (canManage) {
      fetch("/api/employees")
        .then((r) => r.json())
        .then((data) => setEmployees(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
    loadData();
  }, [canManage, loadData]);

  const handleEmployeeChange = (empId: string) => {
    setSelectedEmployee(empId);
    if (empId) {
      loadData(empId);
    } else {
      loadData();
    }
  };

  const createGoal = async () => {
    if (!goalForm.title || !selectedEmployee) {
      setMessage("Title and employee are required");
      return;
    }
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/performance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_goal",
        employee_id: selectedEmployee,
        title: goalForm.title,
        description: goalForm.description,
        due_date: goalForm.due_date || undefined
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error || "Failed to create goal");
    } else {
      setGoalForm({ title: "", description: "", due_date: "" });
      loadData(selectedEmployee);
    }
    setBusy(false);
  };

  const updateGoalProgress = async (id: string, currentProg: number, currentStat: string) => {
    const newProg = Math.min(100, currentProg + 25);
    const newStat = newProg >= 100 ? "completed" : "in_progress";
    
    setBusy(true);
    await fetch("/api/performance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_goal",
        id,
        progress: newProg,
        status: newStat
      }),
    });
    loadData(selectedEmployee || undefined);
    setBusy(false);
  };

  const createReview = async () => {
    if (!reviewForm.period || !selectedEmployee || !reviewForm.feedback) {
      setMessage("Period, feedback, and employee are required");
      return;
    }
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/performance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_review",
        employee_id: selectedEmployee,
        period: reviewForm.period,
        rating: reviewForm.rating,
        feedback: reviewForm.feedback
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error || "Failed to submit review");
    } else {
      setReviewForm({ period: "", rating: 3, feedback: "" });
      loadData(selectedEmployee);
    }
    setBusy(false);
  };

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Performance & Goals</h1>
        <p className="mt-1 text-sm text-gray-500">
          {canManage ? "Set goals and review performance for your team" : "Track your goals and view performance reviews"}
        </p>
      </div>

      {canManage && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="max-w-xs">
              <Select
                label="Select Employee"
                value={selectedEmployee}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                options={[{ value: "", label: "My Performance (Self)" }, ...employees.map(e => ({ value: e.id, label: e.full_name }))]}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-indigo-500" />
                <CardTitle>Active Goals</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {goals.length === 0 ? (
                <EmptyState icon={<TrendingUp className="h-10 w-10" />} title="No active goals" description="No goals have been assigned yet." />
              ) : (
                <div className="space-y-5">
                  {goals.map(goal => (
                    <div key={goal.id} className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{goal.title}</h4>
                          <p className="mt-1 text-sm text-gray-500">{goal.description}</p>
                          {goal.due_date && (
                            <p className="mt-2 flex items-center text-xs text-gray-400">
                              <Clock className="mr-1 h-3 w-3" /> Due: {formatDate(goal.due_date)}
                            </p>
                          )}
                        </div>
                        <Badge variant={goal.status === "completed" ? "success" : "default"}>
                          {goal.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <Progress value={goal.progress} className="h-2 flex-1" />
                        <span className="text-xs font-medium text-gray-600 w-8">{goal.progress}%</span>
                      </div>
                      {(!canManage || selectedEmployee === "" || selectedEmployee === user?.employee_id) && goal.status !== "completed" && (
                        <div className="mt-4 flex justify-end">
                          <Button size="sm" variant="outline" loading={busy} onClick={() => updateGoalProgress(goal.id, goal.progress, goal.status)}>
                            Update Progress (+25%)
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {canManage && selectedEmployee && selectedEmployee !== user?.employee_id && (
            <Card>
              <CardHeader>
                <CardTitle>Assign New Goal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input label="Goal Title" value={goalForm.title} onChange={e => setGoalForm({...goalForm, title: e.target.value})} />
                <Input label="Description" value={goalForm.description} onChange={e => setGoalForm({...goalForm, description: e.target.value})} />
                <Input type="date" label="Due Date" value={goalForm.due_date} onChange={e => setGoalForm({...goalForm, due_date: e.target.value})} />
                <Button className="w-full" onClick={createGoal} loading={busy}>Assign Goal</Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-indigo-500" />
                <CardTitle>Performance Reviews</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <EmptyState icon={<FileText className="h-10 w-10" />} title="No reviews yet" description="Performance reviews will appear here." />
              ) : (
                <div className="space-y-4">
                  {reviews.map(review => (
                    <div key={review.id} className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-gray-900">{review.period}</h4>
                        <div className="flex text-amber-400">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-current" : "text-gray-200"}`} />
                          ))}
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-gray-700">"{review.feedback}"</p>
                      <p className="mt-3 text-xs text-gray-400">Reviewed by {review.reviewer_name} on {formatDate(review.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {canManage && selectedEmployee && selectedEmployee !== user?.employee_id && (
            <Card>
              <CardHeader>
                <CardTitle>Submit Review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input label="Period (e.g. Q3 2026)" value={reviewForm.period} onChange={e => setReviewForm({...reviewForm, period: e.target.value})} />
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Rating (1-5)</label>
                  <input 
                    type="range" min="1" max="5" step="1" 
                    value={reviewForm.rating} 
                    onChange={e => setReviewForm({...reviewForm, rating: Number(e.target.value)})} 
                    className="w-full"
                  />
                  <div className="text-center text-sm font-bold text-indigo-600">{reviewForm.rating} Stars</div>
                </div>
                <Input label="Feedback" value={reviewForm.feedback} onChange={e => setReviewForm({...reviewForm, feedback: e.target.value})} />
                <Button className="w-full" onClick={createReview} loading={busy}>Submit Review</Button>
                {message && <p className="text-sm text-red-600">{message}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
