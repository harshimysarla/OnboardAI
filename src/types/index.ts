export type UserRole = "admin" | "employee";

export type RiskLevel = "green" | "yellow" | "red";

export type TaskCategory = "day1" | "first_week" | "first_month" | "custom";

export type RequestCategory = "IT" | "HR" | "Access" | "Equipment" | "Documentation" | "Other";

export type RequestStatus = "Open" | "In Progress" | "Resolved";

export type RequestPriority = "Low" | "Medium" | "High" | "Urgent";

export type RequestIntent = "IT_ACCESS_REQUEST" | "HR_REQUEST" | "EQUIPMENT_REQUEST" | "DOCUMENTATION_REQUEST" | "OTHER";

export interface Department {
  id: string;
  name: string;
  created_at?: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  created_at?: string;
}

export interface Employee {
  id: string;
  profile_id?: string;
  full_name: string;
  email: string;
  job_title: string;
  department: string;
  manager?: string;
  joining_date: string;
  progress: number;
  risk_level: RiskLevel;
  risk_reasons?: string[];
  risk_recommendation?: string;
  created_at?: string;
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  department: string;
  role_pattern?: string;
  created_at?: string;
}

export interface OnboardingTask {
  id: string;
  template_id?: string;
  title: string;
  description?: string;
  category: TaskCategory;
  mandatory: boolean;
  day_offset: number;
  sort_order: number;
  created_at?: string;
}

export interface EmployeeTask {
  id: string;
  employee_id: string;
  task_id?: string;
  title: string;
  description?: string;
  category: TaskCategory;
  mandatory: boolean;
  completed: boolean;
  completed_at?: string;
  due_date: string;
  sort_order: number;
  created_at?: string;
}

export interface CompanyPolicy {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at?: string;
}

export interface SupportRequest {
  id: string;
  employee_id: string;
  employee_name?: string;
  department?: string;
  category: RequestCategory;
  type: string;
  description: string;
  priority: RequestPriority;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  employee_id: string;
  action: string;
  details?: string;
  created_at: string;
}

export interface RiskFactor {
  factor: string;
  impact: "high" | "medium" | "low";
  details: string;
}

export interface RiskAssessment {
  employee_id: string;
  risk_level: RiskLevel;
  score: number;
  factors: RiskFactor[];
  recommendation?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: RequestIntent;
  intent_details?: {
    category: RequestCategory;
    type: string;
    description: string;
    priority: RequestPriority;
  };
  created_at: string;
}

export interface DashboardStats {
  totalEmployees: number;
  avgProgress: number;
  onTrack: number;
  needsAttention: number;
  highRisk: number;
  openRequests: number;
}

export interface AnalyticsData {
  avgCompletion: number;
  completionByDepartment: { department: string; completion: number }[];
  riskDistribution: { level: string; count: number }[];
  overdueTasks: number;
  requestCategories: { category: string; count: number }[];
  avgOnboardingTime: number;
  trends: { month: string; progress: number }[];
}

export interface DemoUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  employee_id?: string;
}