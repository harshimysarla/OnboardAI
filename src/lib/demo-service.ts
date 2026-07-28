import { DashboardStats, AnalyticsData, Employee, SupportRequest, RiskAssessment } from "@/types";
import { demoEmployees, demoSupportRequests, demoActivityLogs } from "@/data/demo-data";
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

const baseTaskDefs = [
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

const deptTaskDefs: Record<string, { title: string; description: string; category: string; mandatory: boolean }[]> = {
  Engineering: [
    { title: "Request GitHub access", description: "Submit access request for the organization GitHub repository", category: "first_week", mandatory: true },
    { title: "Configure development environment", description: "Set up IDE, SDKs, and project dependencies", category: "first_week", mandatory: true },
    { title: "Review engineering guidelines", description: "Read through engineering best practices and coding standards", category: "first_week", mandatory: true },
    { title: "Set up CI/CD pipeline access", description: "Get access to CI/CD tools and deployment pipelines", category: "first_month", mandatory: false },
  ],
  Finance: [
    { title: "Review financial compliance training", description: "Complete mandatory financial compliance training", category: "first_week", mandatory: true },
    { title: "Set up accounting software access", description: "Request access to accounting and ERP systems", category: "first_week", mandatory: true },
    { title: "Review audit procedures", description: "Familiarize yourself with internal audit procedures", category: "first_month", mandatory: false },
  ],
  HR: [
    { title: "Review HRIS system", description: "Get trained on the HR Information System", category: "first_week", mandatory: true },
    { title: "Review recruitment processes", description: "Familiarize yourself with recruitment workflows", category: "first_week", mandatory: false },
    { title: "Set up payroll system access", description: "Request access to payroll processing systems", category: "first_month", mandatory: true },
  ],
  Marketing: [
    { title: "Review brand guidelines", description: "Read through the company brand guidelines", category: "first_week", mandatory: true },
    { title: "Set up marketing tools access", description: "Request access to marketing automation tools", category: "first_week", mandatory: false },
    { title: "Review content strategy", description: "Familiarize yourself with content strategy", category: "first_month", mandatory: false },
  ],
  Operations: [
    { title: "Review operations workflows", description: "Study standard operating procedures", category: "first_week", mandatory: true },
    { title: "Set up operational tools", description: "Request access to operations management tools", category: "first_week", mandatory: false },
    { title: "Review vendor management", description: "Familiarize yourself with vendor management", category: "first_month", mandatory: false },
  ],
};

function buildTasksForEmployee(emp: Employee, existingCompleted: Record<string, boolean> = {}): DemoTask[] {
  const defs = [...baseTaskDefs, ...(deptTaskDefs[emp.department] || deptTaskDefs.Engineering || [])];
  const now = new Date(emp.joining_date);
  return defs.map((t, i) => {
    const dueDate = new Date(now);
    if (t.category === "day1") { /* same day */ }
    else if (t.category === "first_week") dueDate.setDate(dueDate.getDate() + 7);
    else if (t.category === "first_month") dueDate.setDate(dueDate.getDate() + 30);
    const id = "task-" + emp.id + "-" + i;
    return {
      id,
      employee_id: emp.id,
      title: t.title,
      description: t.description,
      category: t.category,
      mandatory: t.mandatory,
      completed: existingCompleted[id] || false,
      completed_at: undefined,
      due_date: dueDate.toISOString().split("T")[0],
      sort_order: i + 1,
    };
  });
}

function calculateProgress(tasks: DemoTask[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100);
}

// Module-scoped in-memory stores
const taskStore = new Map<string, DemoTask[]>();

export class DemoService {
  private employees: Employee[] = [...demoEmployees.map(e => ({ ...e }))];
  private supportRequests: SupportRequest[] = [...demoSupportRequests.map(r => ({ ...r }))];

  private unresolvedFor(empId: string): number {
    return this.supportRequests.filter(r => r.employee_id === empId && r.status !== "Resolved").length;
  }

  async getEmployees(): Promise<Employee[]> {
    // Recalculate risk for each employee based on current task state
    return this.employees.map(emp => {
      const tasks = taskStore.get(emp.id) || [];
      if (tasks.length > 0) {
        const progress = calculateProgress(tasks);
        const assessment = calculateRiskAssessment({ ...emp, progress }, tasks, this.unresolvedFor(emp.id));
        return { ...emp, progress, risk_level: assessment.risk_level, risk_reasons: assessment.factors.map(f => f.details), risk_recommendation: assessment.recommendation };
      }
      return emp;
    });
  }

  async getEmployeeById(id: string): Promise<Employee | undefined> {
    const emp = this.employees.find(e => e.id === id);
    if (!emp) return undefined;
    const tasks = taskStore.get(id) || [];
    if (tasks.length > 0) {
      const progress = calculateProgress(tasks);
      const assessment = calculateRiskAssessment({ ...emp, progress }, tasks, this.unresolvedFor(id));
      return { ...emp, progress, risk_level: assessment.risk_level, risk_reasons: assessment.factors.map(f => f.details), risk_recommendation: assessment.recommendation };
    }
    return { ...emp };
  }

  async createEmployee(employeeData: Omit<Employee, "id" | "progress" | "risk_level" | "risk_reasons" | "risk_recommendation" | "created_at">): Promise<Employee> {
    const newEmployee: Employee = {
      ...employeeData,
      id: "emp-" + Date.now(),
      progress: 0,
      risk_level: "green",
      risk_reasons: [],
      risk_recommendation: "New employee - onboarding just started.",
    };
    this.employees.push(newEmployee);

    // Auto-generate onboarding tasks
    const tasks = buildTasksForEmployee(newEmployee);
    taskStore.set(newEmployee.id, tasks);

    return newEmployee;
  }

  async getEmployeeTasks(employeeId: string): Promise<DemoTask[]> {
    // Initialize tasks if not yet created
    if (!taskStore.has(employeeId)) {
      const emp = this.employees.find(e => e.id === employeeId);
      if (emp) {
        taskStore.set(employeeId, buildTasksForEmployee(emp));
      }
    }
    return taskStore.get(employeeId) || [];
  }

  async completeTask(employeeId: string, taskId: string): Promise<void> {
    const tasks = await this.getEmployeeTasks(employeeId);
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = true;
      task.completed_at = new Date().toISOString();
    }
    taskStore.set(employeeId, tasks);

    // Update employee progress
    const progress = calculateProgress(tasks);
    const emp = this.employees.find(e => e.id === employeeId);
    if (emp) {
      emp.progress = progress;
      const assessment = calculateRiskAssessment(emp, tasks, this.unresolvedFor(employeeId));
      emp.risk_level = assessment.risk_level;
      emp.risk_reasons = assessment.factors.map(f => f.details);
      emp.risk_recommendation = assessment.recommendation;
    }
  }

  async getSupportRequests(): Promise<SupportRequest[]> {
    return this.supportRequests;
  }

  async createSupportRequest(requestData: Omit<SupportRequest, "id" | "created_at" | "updated_at">): Promise<SupportRequest> {
    const newRequest: SupportRequest = {
      ...requestData,
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
    // Use current progress from employees (may be stale from cache, but we refresh)
    const avg = total > 0 ? Math.round(this.employees.reduce((s, e) => s + (e.progress || 0), 0) / total) : 0;
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
    const total = this.employees.length || 1;
    const avgCompletion = Math.round(this.employees.reduce((s, e) => s + (e.progress || 0), 0) / total);
    const deptMap = new Map<string, number[]>();
    this.employees.forEach(e => {
      if (!deptMap.has(e.department)) deptMap.set(e.department, []);
      deptMap.get(e.department)!.push(e.progress || 0);
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
    this.supportRequests.forEach(r => { catMap.set(r.category, (catMap.get(r.category) || 0) + 1); });
    const requestCategories = Array.from(catMap.entries()).map(([cat, count]) => ({ category: cat, count }));
    return {
      avgCompletion,
      completionByDepartment,
      riskDistribution,
      overdueTasks: this.employees.reduce((s, e) => s + Math.floor(e.progress < 50 ? 2 : 0), 0),
      requestCategories,
      avgOnboardingTime: 45,
      trends: [
        { month: "Jan", progress: 65 }, { month: "Feb", progress: 58 },
        { month: "Mar", progress: 72 }, { month: "Apr", progress: 68 },
        { month: "May", progress: 75 }, { month: "Jun", progress: 80 },
      ],
    };
  }

  async getActivityLogs(): Promise<any[]> {
    return demoActivityLogs;
  }

  getRiskAssessments(): RiskAssessment[] {
    return this.employees
      .filter(e => e.risk_level !== "green" || (e.progress || 0) < 50)
      .map(e => {
        const tasks = taskStore.get(e.id) || [];
        const progress = tasks.length > 0 ? calculateProgress(tasks) : (e.progress || 0);
        return calculateRiskAssessment({ ...e, progress }, tasks, this.unresolvedFor(e.id));
      });
  }
}

export const demoService = new DemoService();
