import { OnboardingTask } from "@/types";

type TaskSeed = Omit<OnboardingTask, "id" | "template_id" | "created_at">;

export const baseTasks: TaskSeed[] = [
  { title: "Complete employee profile", description: "Fill in your personal details and emergency contacts", category: "day1", mandatory: true, day_offset: 0, sort_order: 1 },
  { title: "Submit required documents", description: "Submit ID proof, address proof, and educational certificates", category: "day1", mandatory: true, day_offset: 0, sort_order: 2 },
  { title: "Read company policies", description: "Review the employee handbook and company policies on the HR portal", category: "day1", mandatory: true, day_offset: 0, sort_order: 3 },
  { title: "Set up company email", description: "Configure your company email account on your devices", category: "day1", mandatory: true, day_offset: 0, sort_order: 4 },
  { title: "Complete security training", description: "Complete the mandatory information security awareness training", category: "first_week", mandatory: true, day_offset: 3, sort_order: 5 },
  { title: "Meet your manager", description: "Schedule a 1:1 meeting with your reporting manager", category: "first_week", mandatory: true, day_offset: 3, sort_order: 6 },
  { title: "Configure work environment", description: "Set up your development environment and necessary software", category: "first_week", mandatory: false, day_offset: 5, sort_order: 7 },
  { title: "Complete role-specific training", description: "Complete the training modules specific to your role", category: "first_month", mandatory: true, day_offset: 14, sort_order: 8 },
  { title: "First manager check-in", description: "Attend the first formal check-in meeting with your manager", category: "first_month", mandatory: true, day_offset: 21, sort_order: 9 },
  { title: "Complete onboarding feedback", description: "Fill in the onboarding feedback form", category: "first_month", mandatory: false, day_offset: 28, sort_order: 10 },
];

export const engineeringTasks: TaskSeed[] = [
  { title: "Request GitHub access", description: "Submit access request for the organization GitHub repository", category: "first_week", mandatory: true, day_offset: 2, sort_order: 11 },
  { title: "Configure development environment", description: "Set up IDE, SDKs, and project dependencies", category: "first_week", mandatory: true, day_offset: 4, sort_order: 12 },
  { title: "Review engineering guidelines", description: "Read through the engineering best practices and coding standards", category: "first_week", mandatory: true, day_offset: 4, sort_order: 13 },
  { title: "Set up CI/CD pipeline access", description: "Get access to the CI/CD tools and deployment pipelines", category: "first_month", mandatory: false, day_offset: 10, sort_order: 14 },
];

export const financeTasks: TaskSeed[] = [
  { title: "Review financial compliance training", description: "Complete mandatory financial compliance and regulatory training", category: "first_week", mandatory: true, day_offset: 3, sort_order: 11 },
  { title: "Set up accounting software access", description: "Request access to accounting and ERP systems", category: "first_week", mandatory: true, day_offset: 4, sort_order: 12 },
  { title: "Review audit procedures", description: "Familiarize yourself with internal audit procedures", category: "first_month", mandatory: false, day_offset: 14, sort_order: 13 },
];

export const hrTasks: TaskSeed[] = [
  { title: "Review HRIS system", description: "Get trained on the HR Information System", category: "first_week", mandatory: true, day_offset: 3, sort_order: 11 },
  { title: "Review recruitment processes", description: "Familiarize yourself with the recruitment and hiring workflows", category: "first_week", mandatory: false, day_offset: 5, sort_order: 12 },
  { title: "Set up payroll system access", description: "Request access to payroll processing systems", category: "first_month", mandatory: true, day_offset: 10, sort_order: 13 },
];

export const marketingTasks: TaskSeed[] = [
  { title: "Review brand guidelines", description: "Read through the company brand guidelines and templates", category: "first_week", mandatory: true, day_offset: 3, sort_order: 11 },
  { title: "Set up marketing tools access", description: "Request access to marketing automation and analytics tools", category: "first_week", mandatory: false, day_offset: 4, sort_order: 12 },
  { title: "Review content strategy", description: "Familiarize yourself with the content strategy and calendar", category: "first_month", mandatory: false, day_offset: 14, sort_order: 13 },
];

export const operationsTasks: TaskSeed[] = [
  { title: "Review operations workflows", description: "Study the standard operating procedures for your team", category: "first_week", mandatory: true, day_offset: 3, sort_order: 11 },
  { title: "Set up operational tools", description: "Request access to operations management and monitoring tools", category: "first_week", mandatory: false, day_offset: 5, sort_order: 12 },
  { title: "Review vendor management", description: "Familiarize yourself with vendor management processes", category: "first_month", mandatory: false, day_offset: 14, sort_order: 13 },
];

export function getTasksForRole(department: string): TaskSeed[] {
  const tasks = [...baseTasks];
  switch (department.toLowerCase()) {
    case "engineering":
      tasks.push(...engineeringTasks);
      break;
    case "finance":
      tasks.push(...financeTasks);
      break;
    case "hr":
      tasks.push(...hrTasks);
      break;
    case "marketing":
      tasks.push(...marketingTasks);
      break;
    case "operations":
      tasks.push(...operationsTasks);
      break;
    default:
      tasks.push(...engineeringTasks);
  }
  return tasks.map((t, i) => ({ ...t, sort_order: i + 1 }));
}