import { connectDB } from "@/lib/db";
import { EmployeeTask, ActivityLog } from "@/lib/models";
import { requireAuth } from "./auth";
import { updateEmployeeProgress } from "./employees";
import { serializeMany } from "@/lib/serialize";
import { rewardTaskComplete } from "./gamification";

export async function getEmployeeTasks(employeeId: string) {
  const conn = await connectDB();
  if (!conn) return null;
  const user = await requireAuth();

  const tasks = await EmployeeTask.find({
    employee_id: employeeId,
    company_id: user.company_id,
  })
    .sort({ sort_order: 1 })
    .lean();

  return serializeMany(tasks);
}

export async function completeTask(employeeId: string, taskId: string, companyId: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const existing = await EmployeeTask.findOne({ _id: taskId, employee_id: employeeId }).lean();
  if (!existing) throw new Error("Task not found");
  const alreadyCompleted = !!existing.completed;

  const task = await EmployeeTask.findOneAndUpdate(
    { _id: taskId, employee_id: employeeId },
    { completed: true, completed_at: new Date() },
    { new: true }
  ).lean();

  if (!task) throw new Error("Task not found");

  await updateEmployeeProgress(employeeId, companyId);

  await ActivityLog.create({
    company_id: companyId,
    employee_id: employeeId,
    action: "Task completed",
    details: `Task "${task.title}" marked complete`,
  });

  if (!alreadyCompleted) {
    await rewardTaskComplete(companyId, employeeId);
  }
}