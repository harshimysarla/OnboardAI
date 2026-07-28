# Write demo-service.ts
$path = "C:\wse\OnboardAI\src\lib\demo-service.ts"
$content = @"
import { DashboardStats, AnalyticsData, Employee, SupportRequest, RiskAssessment } from "@/types";
import { demoEmployees, demoSupportRequests, getEmployeeById, getOpenRequests, demoActivityLogs } from "@/data/demo-data";
import { calculateRiskAssessment } from "./risk-engine";

export interface DemoTask {
  id: string;
  employee_id: string;
  title: string;
  description: string;
  category: string;
  mandatory: boolean;
  completed: boolean;
  completed_at: string | undefined;
  due_date: string;
  sort_order: number;
}

export class DemoService {
  private employees: Employee[] = [...demoEmployees];
  private supportRequests: SupportRequest[] = [...demoSupportRequests];

  async getEmployees(): Promise<Employee[]> {
    return this.employees;
  }

  async getEmployeeById(id: string): Promise<Employee | undefined> {
    return this.employees.find(e => e.id === id);
  }

  async createEmployee(employee: Omit<Employee, "id" | "progress" | "risk_level" | "risk_reasons" | "risk_recommendation" | "created_at">): Promise<Employee> {
    const newEmployee: Employee = {
      ...employee,
      id: "emp-" + Date.now(),
      progress: 0,
      risk_level: "green",
      risk_reasons: [],
      risk_recommendation: "New employee - onboarding just started.",
    };
    this.employees.push(newEmployee);
    return newEmployee;
  }

  async updateEmployeeProgress(employeeId: string, progress: number): Promise<void> {
    const emp = this.employees.find(e => e.id === employeeId);
    if (emp) {
      emp.progress = progress;
    }
  }

  async getSupportRequests(): Promise<SupportRequest[]> {
    return this.supportRequests;
  }

  async createSupportRequest(request: Omit<SupportRequest, "id" | "created_at" | "updated_at">): Promise<SupportRequest> {
    const newRequest: SupportRequest = {
      ...request,
      id: "req-" + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.supportRequests.push(newRequest);
    return newRequest;
  }

  async updateRequestStatus(requestId: string, status: string): Promise<void> {
    const req = this.supportRequests.find(r => r.id === requestId);
    if (req) {
      req.status = status as SupportRequest["status"];
      req.updated_at = new Date().toISOString();
    }
  }

  getDashboardStats(): DashboardStats {
    const total = this.employees.length;
    const avg = Math.round(this.employees.reduce((s, e) => s + e.progress, 0) / total);
    const onTrack = this.employees.filter(e => e.risk_level === "green").length;
    const needsAttn = this.employees.filter(e => e.risk_level === "yellow").length;
    const highRisk = this.employees.filter(e => e.risk_level === "red").length;
    const openReqs = this.supportRequests.filter(r => r.status !== "Resolved").length;

    return {
      totalEmployees: total,
      avgProgress: avg,
      onTrack,
      needsAttention: needsAttn,
      highRisk,
      openRequests: openReqs,
    };
  }

  getAnalyticsData(): AnalyticsData {
    const total = this.employees.length;
    const avgCompletion = Math.round(this.employees.reduce((s, e) => s + e.progress, 0) / total);

    const deptMap = new Map<string, number[]>();
    this.employees.forEach(e => {
      if (!deptMap.has(e.department)) deptMap.set(e.department, []);
      deptMap.get(e.department)!.push(e.progress);
    });
    const completionByDepartment = Array.from(deptMap.entries()).map(([dept, progs]) => ({
      department: dept,
      completion: Math.round(progs.reduce((a, b) => a + b, 0) / progs.length),
    }));

    const riskDistribution = [
      { level: "On Track", count: this.employees.filter(e => e.risk_level === "green").length },
      { level: "Needs Attention", count: this.employees.filter(e => e.risk_level === "yellow").length },
      { level: "High Risk", count: this.employees.filter(e => e.risk_level === "red").length },
    ];

    const catMap = new Map<string, number>();
    this.supportRequests.forEach(r => {
      catMap.set(r.category, (catMap.get(r.category) || 0) + 1);
    });
    const requestCategories = Array.from(catMap.entries()).map(([cat, count]) => ({ category: cat, count }));

    return {
      avgCompletion,
      completionByDepartment,
      riskDistribution,
      overdueTasks: total * 2,
      requestCategories,
      avgOnboardingTime: 45,
      trends: [
        { month: "Jan", progress: 65 },
        { month: "Feb", progress: 58 },
        { month: "Mar", progress: 72 },
        { month: "Apr", progress: 68 },
        { month: "May", progress: 75 },
        { month: "Jun", progress: 80 },
      ],
    };
  }

  async getEmployeeTasks(employeeId: string): Promise<DemoTask[]> {
    const employee = this.employees.find(e => e.id === employeeId);
    if (!employee) return [];

    const baseTasks = [
      { title: "Complete employee profile", description: "Fill in your personal details and emergency contacts", category: "day1", mandatory: true },
      { title: "Submit required documents", description: "Submit ID proof, address proof, and educational certificates", category: "day1", mandatory: true },
      { title: "Read company policies", description: "Review the employee handbook and company policies", category: "day1", mandatory: true },
      { title: "Set up company email", description: "Configure your company email account", category: "day1", mandatory: true },
      { title: "Complete security training", description: "Complete the mandatory information security awareness training", category: "first_week", mandatory: true },
      { title: "Meet your manager", description: "Schedule a 1:1 meeting with your reporting manager", category: "first_week", mandatory: true },
      { title: "Configure work environment", description: "Set up your development environment and necessary software", category: "first_week", mandatory: false },
      { title: "Complete role-specific training", description: "Complete training modules specific to your role", category: "first_month", mandatory: true },
      { title: "First manager check-in", description: "Attend the first formal check-in meeting with your manager", category: "first_month", mandatory: true },
      { title: "Complete onboarding feedback", description: "Fill in the onboarding feedback form", category: "first_month", mandatory: false },
    ];

    if (employee.department === "Engineering") {
      baseTasks.push(
        { title: "Request GitHub access", description: "Submit access request for the organization GitHub repository", category: "first_week", mandatory: true },
        { title: "Configure development environment", description: "Set up IDE, SDKs, and project dependencies", category: "first_week", mandatory: true },
        { title: "Review engineering guidelines", description: "Read through engineering best practices and coding standards", category: "first_week", mandatory: true },
        { title: "Set up CI/CD pipeline access", description: "Get access to CI/CD tools and deployment pipelines", category: "first_month", mandatory: false },
      );
    }

    const demoTaskStore = globalThis.__demoTasks as Map<string, DemoTask[]> | undefined;
    const tasks = demoTaskStore?.get(employeeId) || [];

    return baseTasks.map((t, i) => {
      const existing = tasks.find(t2 => t2.title === t.title);
      return {
        id: existing?.id || "task-" + employeeId + "-" + i,
        employee_id: employeeId,
        title: t.title,
        description: t.description,
        category: t.category,
        mandatory: t.mandatory,
        completed: existing?.completed || (employee.progress > (i + 1) * 10),
        completed_at: existing?.completed_at,
        due_date: t.category === "day1" ? employee.joining_date
          : t.category === "first_week"
          ? new Date(new Date(employee.joining_date).getTime() + 7 * 86400000).toISOString().split("T")[0]
          : new Date(new Date(employee.joining_date).getTime() + 30 * 86400000).toISOString().split("T")[0],
        sort_order: i + 1,
      };
    });
  }

  async completeTask(employeeId: string, taskId: string): Promise<void> {
    const store = globalThis.__demoTasks as Map<string, DemoTask[]> || new Map();
    globalThis.__demoTasks = store;
    if (!store.has(employeeId)) store.set(employeeId, []);
    const tasks = store.get(employeeId)!;
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = true;
      task.completed_at = new Date().toISOString();
    } else {
      tasks.push({
        id: taskId,
        employee_id: employeeId,
        completed: true,
        completed_at: new Date().toISOString(),
      } as DemoTask);
    }
    const allTasks = await this.getEmployeeTasks(employeeId);
    const completed = allTasks.filter(t => t.completed).length;
    const progress = Math.round((completed / allTasks.length) * 100);
    await this.updateEmployeeProgress(employeeId, progress);
  }

  async getActivityLogs(): Promise<any[]> {
    return demoActivityLogs;
  }

  getRiskAssessments(): RiskAssessment[] {
    return this.employees
      .filter(e => e.risk_level !== "green" || e.progress < 50)
      .map(e => calculateRiskAssessment(e, []));
  }
}

export const demoService = new DemoService();
"@
$content | Out-File -FilePath $path -Encoding UTF8
Write-Host "Written demo-service.ts"

# Write utils.ts
$path2 = "C:\wse\OnboardAI\src\lib\utils.ts"
$content2 = @"
import { RiskLevel, SupportRequest } from "@/types";

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "green": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "yellow": return "bg-amber-100 text-amber-800 border-amber-200";
    case "red": return "bg-red-100 text-red-800 border-red-200";
  }
}

export function getRiskDot(level: RiskLevel): string {
  switch (level) {
    case "green": return "bg-emerald-500";
    case "yellow": return "bg-amber-500";
    case "red": return "bg-red-500";
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "Open": return "bg-blue-100 text-blue-800 border-blue-200";
    case "In Progress": return "bg-amber-100 text-amber-800 border-amber-200";
    case "Resolved": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case "Low": return "bg-gray-100 text-gray-600";
    case "Medium": return "bg-blue-100 text-blue-700";
    case "High": return "bg-orange-100 text-orange-700";
    case "Urgent": return "bg-red-100 text-red-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getDaysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}
"@
$content2 | Out-File -FilePath $path2 -Encoding UTF8
Write-Host "Written utils.ts"
"@