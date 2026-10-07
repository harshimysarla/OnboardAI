import { connectDB } from "@/lib/db";
import { Employee, Department, Company, EmployeeTask, ActivityLog, SupportRequest, Policy, AttendanceRecord, LeaveBalance, TrainingAssignment, Announcement, CompanyEvent, Notification } from "@/lib/models";
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    department, tasks, activities, requests, policies,
    attendance, leaveBalance, trainings, announcements, events, notifications
  ] = await Promise.all([
    employee.department_id ? Department.findById(employee.department_id).lean() : null,
    EmployeeTask.find({ employee_id: user.employee_id, company_id: user.company_id })
      .sort({ sort_order: 1, created_at: 1 }).lean(),
    ActivityLog.find({ company_id: user.company_id, employee_id: user.employee_id })
      .sort({ created_at: -1 }).limit(8).lean(),
    SupportRequest.find({ company_id: user.company_id, employee_id: user.employee_id })
      .sort({ created_at: -1 }).limit(4).lean(),
    Policy.find({ company_id: user.company_id })
      .sort({ created_at: -1 }).limit(3).select("title category created_at").lean(),
    AttendanceRecord.find({ company_id: user.company_id, employee_id: user.employee_id, date: { $gte: thisMonthStart } })
      .sort({ date: -1 }).lean(),
    LeaveBalance.findOne({ company_id: user.company_id, employee_id: user.employee_id }).lean(),
    TrainingAssignment.find({ company_id: user.company_id, employee_id: user.employee_id })
      .populate("course_id", "title category")
      .sort({ created_at: -1 }).lean(),
    Announcement.find({ company_id: user.company_id, published_at: { $lte: new Date() } })
      .sort({ pinned: -1, published_at: -1 }).limit(3).lean(),
    CompanyEvent.find({ company_id: user.company_id, date: { $gte: today } })
      .sort({ date: 1 }).limit(3).lean(),
    Notification.find({ company_id: user.company_id, user_id: user.id })
      .sort({ created_at: -1 }).limit(5).lean(),
  ]);
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
    attendance: serializeMany(attendance || []),
    leaveBalance: leaveBalance ? serializeDoc(leaveBalance as Record<string, unknown>) : null,
    trainings: serializeMany(trainings || []),
    announcements: serializeMany(announcements || []),
    events: serializeMany(events || []),
    notifications: serializeMany(notifications || []),
  };
}