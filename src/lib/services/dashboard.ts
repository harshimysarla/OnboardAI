import { connectDB } from "@/lib/db";
import { Employee, Department, Company, EmployeeTask, ActivityLog, SupportRequest, Policy } from "@/lib/models";
import { requireAuth } from "@/lib/services/auth";
import { serializeDoc, serializeMany } from "@/lib/serialize";

/**
 * Aggregated payload for the employee portal dashboard. Keeps the
 * dashboard rendering logic thin — one request, all widgets.
 */
export async function getEmployeeDashboard() {
  const conn = await connectDB();
  if (!conn) return null;
  const user = await requireAuth();
  if (!user.employee_id) return null;

  const [employee, company] = await Promise.all([
    Employee.findOne({ _id: user.employee_id, company_id: user.company_id }).lean(),
    Company.findById(user.company_id).lean(),
  ]);
  if (!employee) return null;

  const [department, tasks, activities, requests, policies] = await Promise.all([
    employee.department_id ? Department.findById(employee.department_id).lean() : null,
    EmployeeTask.find({
      employee_id: user.employee_id,
      company_id: user.company_id,
    }).sort({ sort_order: 1, created_at: 1 }).lean(),
    ActivityLog.find({ company_id: user.company_id, employee_id: user.employee_id })
      .sort({ created_at: -1 })
      .limit(8)
      .lean(),
    SupportRequest.find({ company_id: user.company_id, employee_id: user.employee_id })
      .sort({ created_at: -1 })
      .limit(4)
      .lean(),
    Policy.find({ company_id: user.company_id })
      .sort({ created_at: -1 })
      .limit(3)
      .select("title category created_at")
      .lean(),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const serializedTasks = (tasks || []).map((t) =>
    serializeDoc(t.toObject())
  ) as {
    id: string;
    title: string;
    description: string;
    category: string;
    mandatory: boolean;
    completed: boolean;
    due_date: string;
    completed_at?: string;
  }[];
  const completed = serializedTasks.filter((t) => t.completed).length;
  const overdue = serializedTasks.filter((t) => !t.completed && new Date(t.due_date) < new Date()).length;
  const dueToday = serializedTasks.filter(
    (t) => !t.completed && t.due_date && new Date(t.due_date) >= today && new Date(t.due_date) < tomorrow
  );
  const upcoming = serializedTasks
    .filter((t) => !t.completed && t.due_date && new Date(t.due_date) >= tomorrow)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 5);

  return {
    employee: {
      ...serializeDoc(employee as unknown as Record<string, unknown>),
      department: department?.name || "",
    },
    company: {
      name: user.company_name,
      office_info: serializeDoc((company.office_info || {}) as Record<string, unknown>),
    },
    today,
    tasks: serializedTasks,
    taskSummary: {
      total: serializedTasks.length,
      completed,
      overdue,
      pending: serializedTasks.length - completed,
      recent: [...dueToday, ...upcoming].slice(0, 5),
    },
    activities: serializeMany(activities || []),
    requests: serializeMany(requests || []),
    policies: serializeMany(policies || []),
  };
}