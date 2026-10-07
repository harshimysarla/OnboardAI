import { connectDB } from "@/lib/db";
import { PerformanceGoal, PerformanceReview, Employee, User } from "@/lib/models";
import { requireAuth } from "./auth";
import { serializeDoc, serializeMany, toId } from "@/lib/serialize";

export async function getPerformanceData(employeeId?: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  const user = await requireAuth();

  const query: Record<string, unknown> = { company_id: user.company_id };
  if (employeeId) {
    query.employee_id = employeeId;
  } else if (user.role === "employee") {
    query.employee_id = user.employee_id;
  }

  const [goals, reviews] = await Promise.all([
    PerformanceGoal.find(query).sort({ due_date: 1 }).lean(),
    PerformanceReview.find(query).sort({ created_at: -1 }).lean(),
  ]);

  return {
    goals: serializeMany(goals),
    reviews: serializeMany(reviews),
  };
}

export async function createGoal(data: { employee_id: string; title: string; description?: string; due_date?: string }) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  const user = await requireAuth();
  if (user.role === "employee") throw new Error("Unauthorized");

  const goal = await PerformanceGoal.create({
    company_id: user.company_id,
    employee_id: data.employee_id,
    title: data.title,
    description: data.description || "",
    due_date: data.due_date ? new Date(data.due_date) : undefined,
    assigned_by: user.id,
    assigned_by_name: user.full_name,
  });

  return serializeDoc(goal.toObject());
}

export async function updateGoalProgress(id: string, progress: number, status: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  const user = await requireAuth();

  const goal = await PerformanceGoal.findOne({ _id: id, company_id: user.company_id });
  if (!goal) throw new Error("Goal not found");
  
  if (user.role === "employee" && goal.employee_id.toString() !== user.employee_id) {
    throw new Error("Unauthorized");
  }

  goal.progress = progress;
  goal.status = status;
  await goal.save();

  return serializeDoc(goal.toObject());
}

export async function createReview(data: { employee_id: string; period: string; rating: number; feedback: string }) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  const user = await requireAuth();
  if (user.role === "employee") throw new Error("Unauthorized");

  const review = await PerformanceReview.create({
    company_id: user.company_id,
    employee_id: data.employee_id,
    reviewer_id: user.id,
    reviewer_name: user.full_name,
    period: data.period,
    rating: data.rating,
    feedback: data.feedback,
    status: "published",
  });

  return serializeDoc(review.toObject());
}
