import { Employee, SupportRequest, ActivityLog, DemoUser } from "@/types";

export const demoDepartments = [
  { id: "dept-1", name: "Engineering" },
  { id: "dept-2", name: "HR" },
  { id: "dept-3", name: "Finance" },
  { id: "dept-4", name: "Marketing" },
  { id: "dept-5", name: "Operations" },
];

export const demoEmployees: Employee[] = [
  { id: "emp-1", full_name: "Rahul Sharma", email: "rahul.sharma@onboardai.com", job_title: "Software Developer", department: "Engineering", manager: "Anita Desai", joining_date: "2025-01-15", progress: 80, risk_level: "green", risk_reasons: [], risk_recommendation: "On track with onboarding. Complete remaining role-specific training." },
  { id: "emp-2", full_name: "Priya Patel", email: "priya.patel@onboardai.com", job_title: "Frontend Engineer", department: "Engineering", manager: "Anita Desai", joining_date: "2025-02-01", progress: 45, risk_level: "yellow", risk_reasons: ["Security training overdue", "GitHub access pending", "Engineering guidelines not reviewed"], risk_recommendation: "Resolve development-system access and schedule a manager check-in." },
  { id: "emp-3", full_name: "Arjun Kumar", email: "arjun.kumar@onboardai.com", job_title: "Backend Engineer", department: "Engineering", manager: "Anita Desai", joining_date: "2025-02-20", progress: 25, risk_level: "red", risk_reasons: ["3 mandatory tasks incomplete", "Progress below 30%", "No manager check-in scheduled", "Security training not started"], risk_recommendation: "Urgent intervention required. Schedule immediate manager meeting and prioritize mandatory task completion." },
  { id: "emp-4", full_name: "Sneha Reddy", email: "sneha.reddy@onboardai.com", job_title: "HR Business Partner", department: "HR", manager: "Vikram Singh", joining_date: "2025-01-10", progress: 90, risk_level: "green", risk_reasons: [], risk_recommendation: "On track. Only onboarding feedback remaining." },
  { id: "emp-5", full_name: "Karan Mehta", email: "karan.mehta@onboardai.com", job_title: "Financial Analyst", department: "Finance", manager: "Deepak Joshi", joining_date: "2025-02-10", progress: 60, risk_level: "green", risk_reasons: [], risk_recommendation: "Good progress. Complete compliance training this week." },
  { id: "emp-6", full_name: "Ananya Iyer", email: "ananya.iyer@onboardai.com", job_title: "Marketing Specialist", department: "Marketing", manager: "Rohit Verma", joining_date: "2025-02-25", progress: 35, risk_level: "yellow", risk_reasons: ["Brand guidelines not reviewed", "Marketing tools access pending"], risk_recommendation: "Expedite marketing tools access and ensure brand guidelines review is scheduled." },
  { id: "emp-7", full_name: "Rohit Nair", email: "rohit.nair@onboardai.com", job_title: "Operations Coordinator", department: "Operations", manager: "Sunita Rao", joining_date: "2025-03-01", progress: 15, risk_level: "red", risk_reasons: ["Only 2 tasks completed", "Operations workflows not reviewed", "Joining date was 28 days ago"], risk_recommendation: "Assign buddy and schedule daily check-ins for first week." },
  { id: "emp-8", full_name: "Meera Joshi", email: "meera.joshi@onboardai.com", job_title: "DevOps Engineer", department: "Engineering", manager: "Anita Desai", joining_date: "2025-01-20", progress: 70, risk_level: "green", risk_reasons: [], risk_recommendation: "Steady progress. CI/CD access pending manager approval." },
];

export const demoSupportRequests: SupportRequest[] = [
  { id: "req-1", employee_id: "emp-2", employee_name: "Priya Patel", department: "Engineering", category: "IT", type: "GitHub Access", description: "Need access to the organization GitHub repository for project repositories.", priority: "Medium", status: "Open", created_at: "2025-02-05T10:30:00Z", updated_at: "2025-02-05T10:30:00Z" },
  { id: "req-2", employee_id: "emp-3", employee_name: "Arjun Kumar", department: "Engineering", category: "Access", type: "Database Access", description: "Require read access to staging database for development.", priority: "High", status: "In Progress", created_at: "2025-02-22T14:00:00Z", updated_at: "2025-02-23T09:15:00Z" },
  { id: "req-3", employee_id: "emp-5", employee_name: "Karan Mehta", department: "Finance", category: "IT", type: "ERP Access", description: "Need access to the financial reporting module in ERP system.", priority: "Medium", status: "Resolved", created_at: "2025-02-12T11:00:00Z", updated_at: "2025-02-15T16:30:00Z" },
  { id: "req-4", employee_id: "emp-6", employee_name: "Ananya Iyer", department: "Marketing", category: "IT", type: "Marketing Tools", description: "Request access to HubSpot and Google Analytics accounts.", priority: "Low", status: "Open", created_at: "2025-02-27T09:00:00Z", updated_at: "2025-02-27T09:00:00Z" },
  { id: "req-5", employee_id: "emp-7", employee_name: "Rohit Nair", department: "Operations", category: "Equipment", type: "Laptop Issue", description: "Laptop keyboard malfunctioning, need replacement.", priority: "Urgent", status: "In Progress", created_at: "2025-03-02T10:00:00Z", updated_at: "2025-03-02T11:30:00Z" },
  { id: "req-6", employee_id: "emp-8", employee_name: "Meera Joshi", department: "Engineering", category: "Access", type: "CI/CD Pipeline", description: "Need access to deployment pipelines for the microservices.", priority: "Medium", status: "Open", created_at: "2025-01-25T15:00:00Z", updated_at: "2025-01-25T15:00:00Z" },
  { id: "req-7", employee_id: "emp-1", employee_name: "Rahul Sharma", department: "Engineering", category: "Documentation", type: "API Docs", description: "Internal API documentation access needed.", priority: "Low", status: "Resolved", created_at: "2025-01-18T10:00:00Z", updated_at: "2025-01-20T14:00:00Z" },
  { id: "req-8", employee_id: "emp-4", employee_name: "Sneha Reddy", department: "HR", category: "HR", type: "HRIS Access", description: "Full admin access to HRIS system required.", priority: "High", status: "In Progress", created_at: "2025-01-12T11:00:00Z", updated_at: "2025-01-14T10:00:00Z" },
];

export const demoActivityLogs: ActivityLog[] = [
  { id: "act-1", employee_id: "emp-1", action: "Completed task", details: "Complete employee profile", created_at: "2025-01-15T09:00:00Z" },
  { id: "act-2", employee_id: "emp-1", action: "Completed task", details: "Submit required documents", created_at: "2025-01-15T10:30:00Z" },
  { id: "act-3", employee_id: "emp-1", action: "Completed task", details: "Read company policies", created_at: "2025-01-16T11:00:00Z" },
  { id: "act-4", employee_id: "emp-1", action: "Completed task", details: "Set up company email", created_at: "2025-01-16T14:00:00Z" },
  { id: "act-5", employee_id: "emp-1", action: "Completed task", details: "Complete security training", created_at: "2025-01-18T10:00:00Z" },
  { id: "act-6", employee_id: "emp-2", action: "Completed task", details: "Complete employee profile", created_at: "2025-02-01T09:00:00Z" },
  { id: "act-7", employee_id: "emp-2", action: "Completed task", details: "Submit required documents", created_at: "2025-02-01T11:00:00Z" },
  { id: "act-8", employee_id: "emp-2", action: "Created request", details: "GitHub Access request", created_at: "2025-02-05T10:30:00Z" },
  { id: "act-9", employee_id: "emp-3", action: "Completed task", details: "Complete employee profile", created_at: "2025-02-20T09:00:00Z" },
  { id: "act-10", employee_id: "emp-3", action: "Created request", details: "Database Access request", created_at: "2025-02-22T14:00:00Z" },
];

export const demoUsers: DemoUser[] = [
  { id: "user-1", email: "hr@onboardai.com", full_name: "HR Admin", role: "admin", employee_id: undefined },
  { id: "user-2", email: "rahul.sharma@onboardai.com", full_name: "Rahul Sharma", role: "employee", employee_id: "emp-1" },
  { id: "user-3", email: "priya.patel@onboardai.com", full_name: "Priya Patel", role: "employee", employee_id: "emp-2" },
  { id: "user-4", email: "arjun.kumar@onboardai.com", full_name: "Arjun Kumar", role: "employee", employee_id: "emp-3" },
];

export function getEmployeeById(id: string): Employee | undefined {
  return demoEmployees.find(e => e.id === id);
}

export function getEmployeesByDepartment(dept: string): Employee[] {
  return demoEmployees.filter(e => e.department === dept);
}

export function getRequestsByEmployee(empId: string): SupportRequest[] {
  return demoSupportRequests.filter(r => r.employee_id === empId);
}

export function getRequestsByStatus(status: SupportRequest["status"]): SupportRequest[] {
  return demoSupportRequests.filter(r => r.status === status);
}

export function getOpenRequests(): SupportRequest[] {
  return demoSupportRequests.filter(r => r.status === "Open");
}

export function getActivityByEmployee(empId: string): ActivityLog[] {
  return demoActivityLogs.filter(a => a.employee_id === empId);
}

export function getDemoUserByEmail(email: string): DemoUser | undefined {
  return demoUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
}
