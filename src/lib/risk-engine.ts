import { Employee, RiskLevel, RiskAssessment, RiskFactor } from "@/types";

export function calculateRiskAssessment(
  employee: Employee,
  tasks: { completed: boolean; mandatory: boolean; due_date: string }[],
  unresolvedRequests: number = 0
): RiskAssessment {
  const now = new Date();
  const joiningDate = new Date(employee.joining_date);
  const daysSinceJoining = Math.floor((now.getTime() - joiningDate.getTime()) / (1000 * 60 * 60 * 24));

  const totalTasks = tasks.length || 1;
  const completedTasks = tasks.filter(t => t.completed).length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const overdueTasks = tasks.filter(t => !t.completed && new Date(t.due_date) < now).length;
  const overdueMandatory = tasks.filter(t => !t.completed && t.mandatory && new Date(t.due_date) < now).length;

  const expectedProgress = calculateExpectedProgress(daysSinceJoining);
  const progressGap = expectedProgress - progress;

  const factors: RiskFactor[] = [];
  let score = 0;

  // Factor 1: Progress
  if (progress < 20) {
    score += 30;
    factors.push({ factor: "Onboarding Progress", impact: "high", details: `Progress is ${progress}%, expected ${expectedProgress}%` });
  } else if (progress < 50) {
    score += 20;
    factors.push({ factor: "Onboarding Progress", impact: "medium", details: `Progress is ${progress}%, expected ${expectedProgress}%` });
  } else if (progress < 80) {
    score += 10;
  }

  // Factor 2: Overdue mandatory tasks
  if (overdueMandatory > 2) {
    score += 30;
    factors.push({ factor: "Overdue Mandatory Tasks", impact: "high", details: `${overdueMandatory} mandatory tasks are overdue` });
  } else if (overdueMandatory > 0) {
    score += 15;
    factors.push({ factor: "Overdue Mandatory Tasks", impact: "medium", details: `${overdueMandatory} mandatory task(s) overdue` });
  }

  // Factor 3: Overdue tasks
  if (overdueTasks > 3) {
    score += 15;
    factors.push({ factor: "Overdue Tasks", impact: "medium", details: `${overdueTasks} total tasks overdue` });
  } else if (overdueTasks > 0) {
    score += 5;
  }

  // Factor 4: Unresolved requests
  if (unresolvedRequests > 2) {
    score += 15;
    factors.push({ factor: "Unresolved Requests", impact: "medium", details: `${unresolvedRequests} support requests unresolved` });
  } else if (unresolvedRequests > 0) {
    score += 10;
    factors.push({ factor: "Unresolved Requests", impact: "low", details: `${unresolvedRequests} support request(s) pending` });
  }

  // Factor 5: Days since joining (urgency)
  if (daysSinceJoining > 21 && progress < 30) {
    score += 20;
    factors.push({ factor: "Time Since Joining", impact: "high", details: `${daysSinceJoining} days since joining, but only ${progress}% progress` });
  } else if (daysSinceJoining > 14 && progress < 50) {
    score += 10;
    factors.push({ factor: "Time Since Joining", impact: "medium", details: `${daysSinceJoining} days since joining with ${progress}% progress` });
  }

  // Factor 6: Completion rate gap
  if (progressGap > 30) {
    score += 20;
    factors.push({ factor: "Progress Below Expected", impact: "high", details: `Progress is ${progressGap}% below expected level` });
  } else if (progressGap > 15) {
    score += 10;
    factors.push({ factor: "Progress Below Expected", impact: "medium", details: `Progress is ${progressGap}% below expected level` });
  }

  // Normalize score to 0-100
  score = Math.min(score, 100);

  let riskLevel: RiskLevel;
  if (score < 30) riskLevel = "green";
  else if (score < 60) riskLevel = "yellow";
  else riskLevel = "red";

  const recommendation = generateRecommendation(riskLevel, factors, employee);

  return {
    employee_id: employee.id,
    risk_level: riskLevel,
    score,
    factors,
    recommendation,
  };
}

function calculateExpectedProgress(daysSinceJoining: number): number {
  if (daysSinceJoining <= 1) return 20;
  if (daysSinceJoining <= 7) return 35;
  if (daysSinceJoining <= 14) return 50;
  if (daysSinceJoining <= 21) return 65;
  if (daysSinceJoining <= 30) return 80;
  return 90;
}

function generateRecommendation(riskLevel: RiskLevel, factors: RiskFactor[], employee: Employee): string {

  if (riskLevel === "green") {
    return `${employee.full_name} is on track with onboarding. ${factors.length > 0 ? `Focus on: ${factors.map(f => f.details).join(". ")}.` : "Excellent progress, continue as planned."}`;
  }

  if (riskLevel === "yellow") {
    let rec = `${employee.full_name} needs attention. `;
    rec += `Priority actions: `;
    const actionItems: string[] = [];
    if (factors.some(f => f.factor.includes("Mandatory"))) actionItems.push("Complete overdue mandatory tasks immediately");
    if (factors.some(f => f.factor.includes("Progress"))) actionItems.push("Schedule catch-up sessions");
    if (factors.some(f => f.factor.includes("Unresolved"))) actionItems.push("Resolve pending support requests");
    rec += actionItems.join(", ");
    rec += ". Schedule a manager check-in to discuss progress blockers.";
    return rec;
  }

  let rec = `URGENT INTERVENTION REQUIRED for ${employee.full_name}. `;
  const actionItems: string[] = [];
  if (factors.some(f => f.factor.includes("Mandatory"))) actionItems.push("Escalate incomplete mandatory tasks to manager");
  actionItems.push("Schedule emergency 1:1 with manager");
  if (factors.some(f => f.factor.includes("Unresolved"))) actionItems.push("Expedite pending support requests");
  if (factors.some(f => f.factor.includes("Progress"))) actionItems.push("Assign onboarding buddy for daily check-ins");
  rec += actionItems.join(". ");
  rec += ". Consider HR intervention if progress does not improve within 48 hours.";
  return rec;
}
