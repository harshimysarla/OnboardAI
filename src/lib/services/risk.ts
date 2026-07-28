import { createServerClient } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireAuth } from "./auth";

interface RiskFactor {
  factor: string;
  impact: "high" | "medium" | "low";
  details: string;
}

interface RiskResult {
  employee_id: string;
  risk_level: "green" | "yellow" | "red";
  score: number;
  factors: RiskFactor[];
  recommendation: string;
}

function calculateExpectedProgress(daysSinceJoining: number): number {
  if (daysSinceJoining <= 1) return 20;
  if (daysSinceJoining <= 7) return 35;
  if (daysSinceJoining <= 14) return 50;
  if (daysSinceJoining <= 21) return 65;
  if (daysSinceJoining <= 30) return 80;
  return 90;
}

function generateRecommendation(riskLevel: string, factors: RiskFactor[], employeeName: string): string {
  if (riskLevel === "green") {
    return `${employeeName} is on track with onboarding. Continue as planned.`;
  }
  if (riskLevel === "yellow") {
    let rec = `${employeeName} needs attention. Priority: `;
    const items: string[] = [];
    if (factors.some((f) => f.factor.includes("Mandatory"))) items.push("complete overdue mandatory tasks");
    if (factors.some((f) => f.factor.includes("Progress"))) items.push("schedule catch-up sessions");
    if (factors.some((f) => f.factor.includes("Unresolved"))) items.push("resolve pending support requests");
    rec += items.join(", ");
    rec += ". Schedule a manager check-in.";
    return rec;
  }
  let rec = `URGENT INTERVENTION for ${employeeName}. `;
  const items: string[] = [];
  if (factors.some((f) => f.factor.includes("Mandatory"))) items.push("Escalate incomplete mandatory tasks to manager");
  items.push("Schedule emergency 1:1 with manager");
  if (factors.some((f) => f.factor.includes("Unresolved"))) items.push("Expedite pending support requests");
  if (factors.some((f) => f.factor.includes("Progress"))) items.push("Assign onboarding buddy for daily check-ins");
  rec += items.join(". ");
  rec += ". Consider HR intervention if no improvement within 48 hours.";
  return rec;
}

export async function calculateEmployeeRisk(
  employee: { id: string; full_name: string; joining_date: string; progress: number },
  tasks: { completed: boolean; mandatory: boolean; due_date: string }[],
  unresolvedRequests: number
): Promise<RiskResult> {
  const now = new Date();
  const joiningDate = new Date(employee.joining_date);
  const daysSinceJoining = Math.floor(
    (now.getTime() - joiningDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const totalTasks = tasks.length || 1;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const progress = employee.progress;
  const overdueTasks = tasks.filter(
    (t) => !t.completed && new Date(t.due_date) < now
  ).length;
  const overdueMandatory = tasks.filter(
    (t) => !t.completed && t.mandatory && new Date(t.due_date) < now
  ).length;

  const expectedProgress = calculateExpectedProgress(daysSinceJoining);
  const progressGap = expectedProgress - progress;

  const factors: RiskFactor[] = [];
  let score = 0;

  if (progress < 20) { score += 30; factors.push({ factor: "Onboarding Progress", impact: "high", details: `Progress is ${progress}%, expected ${expectedProgress}%` }); }
  else if (progress < 50) { score += 20; factors.push({ factor: "Onboarding Progress", impact: "medium", details: `Progress is ${progress}%, expected ${expectedProgress}%` }); }
  else if (progress < 80) { score += 10; }

  if (overdueMandatory > 2) { score += 30; factors.push({ factor: "Overdue Mandatory Tasks", impact: "high", details: `${overdueMandatory} mandatory tasks overdue` }); }
  else if (overdueMandatory > 0) { score += 15; factors.push({ factor: "Overdue Mandatory Tasks", impact: "medium", details: `${overdueMandatory} mandatory task(s) overdue` }); }

  if (overdueTasks > 3) { score += 15; factors.push({ factor: "Overdue Tasks", impact: "medium", details: `${overdueTasks} tasks overdue` }); }
  else if (overdueTasks > 0) { score += 5; }

  if (unresolvedRequests > 2) { score += 15; factors.push({ factor: "Unresolved Requests", impact: "medium", details: `${unresolvedRequests} requests unresolved` }); }
  else if (unresolvedRequests > 0) { score += 10; factors.push({ factor: "Unresolved Requests", impact: "low", details: `${unresolvedRequests} request(s) pending` }); }

  if (daysSinceJoining > 21 && progress < 30) { score += 20; factors.push({ factor: "Time Since Joining", impact: "high", details: `${daysSinceJoining} days since joining, ${progress}% progress` }); }
  else if (daysSinceJoining > 14 && progress < 50) { score += 10; factors.push({ factor: "Time Since Joining", impact: "medium", details: `${daysSinceJoining} days since joining, ${progress}% progress` }); }

  if (progressGap > 30) { score += 20; factors.push({ factor: "Progress Below Expected", impact: "high", details: `Progress ${progressGap}% below expected` }); }
  else if (progressGap > 15) { score += 10; factors.push({ factor: "Progress Below Expected", impact: "medium", details: `Progress ${progressGap}% below expected` }); }

  score = Math.min(score, 100);

  let riskLevel: "green" | "yellow" | "red";
  if (score < 30) riskLevel = "green";
  else if (score < 60) riskLevel = "yellow";
  else riskLevel = "red";

  return {
    employee_id: employee.id,
    risk_level: riskLevel,
    score,
    factors,
    recommendation: generateRecommendation(riskLevel, factors, employee.full_name),
  };
}

export async function getRiskAssessments() {
  if (!isSupabaseConfigured) return [];
  const user = await requireAuth();
  const supabase = await createServerClient();
  if (!supabase) return [];

  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .eq("company_id", user.company_id);

  if (!employees) return [];

  const assessments: RiskResult[] = [];

  for (const emp of employees) {
    const { data: tasks } = await supabase
      .from("employee_tasks")
      .select("completed, mandatory, due_date")
      .eq("employee_id", emp.id);

    const { data: requests } = await supabase
      .from("support_requests")
      .select("id")
      .eq("employee_id", emp.id)
      .neq("status", "Resolved");

    const assessment = await calculateEmployeeRisk(
      emp,
      tasks || [],
      requests?.length || 0
    );
    assessments.push(assessment);
  }

  return assessments;
}
