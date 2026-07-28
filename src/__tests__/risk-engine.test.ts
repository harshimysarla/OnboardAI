import { describe, it, expect } from "vitest";
import { calculateRiskAssessment } from "@/lib/risk-engine";
import type { Employee } from "@/types";

const baseEmployee: Employee = {
  id: "emp-1",
  full_name: "Test User",
  email: "test@example.com",
  job_title: "Engineer",
  department: "Engineering",
  joining_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  progress: 75,
  risk_level: "green",
};

function makeTasks(
  completed: number,
  total: number,
  mandatory: number = 0,
  overdueMandatory: number = 0
): { completed: boolean; mandatory: boolean; due_date: string }[] {
  const tasks: { completed: boolean; mandatory: boolean; due_date: string }[] = [];
  const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

  for (let i = 0; i < total; i++) {
    const isCompleted = i < completed;
    const isMandatory = i < mandatory;
    const isOverdueMandatory = i < overdueMandatory;
    tasks.push({
      completed: isCompleted,
      mandatory: isMandatory,
      due_date: isOverdueMandatory ? pastDate : futureDate,
    });
  }
  return tasks;
}

describe("calculateRiskAssessment", () => {
  it("returns green for employee with high progress and no overdue tasks", () => {
    const emp = { ...baseEmployee, progress: 90, joining_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] };
    const tasks = makeTasks(9, 10);
    const result = calculateRiskAssessment(emp, tasks, 0);
    expect(result.risk_level).toBe("green");
    expect(result.score).toBeLessThan(30);
  });

  it("returns yellow for employee with low progress and overdue tasks", () => {
    const emp = { ...baseEmployee, progress: 30, joining_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] };
    const tasks = makeTasks(3, 10, 1, 1);
    const result = calculateRiskAssessment(emp, tasks, 0);
    expect(["yellow", "red"]).toContain(result.risk_level);
    expect(result.score).toBeGreaterThanOrEqual(30);
  });

  it("returns red for employee with very low progress and many overdue mandatory tasks", () => {
    const emp = { ...baseEmployee, progress: 10, joining_date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] };
    const tasks = makeTasks(1, 10, 3, 3);
    const result = calculateRiskAssessment(emp, tasks, 3);
    expect(result.risk_level).toBe("red");
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it("includes unresolved requests as a risk factor", () => {
    const emp = { ...baseEmployee, progress: 50, joining_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] };
    const tasks = makeTasks(5, 10);
    const result = calculateRiskAssessment(emp, tasks, 3);
    expect(result.factors.some(f => f.factor === "Unresolved Requests")).toBe(true);
  });

  it("returns recommendation text", () => {
    const emp = { ...baseEmployee, progress: 20, joining_date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] };
    const tasks = makeTasks(2, 10, 1, 1);
    const result = calculateRiskAssessment(emp, tasks, 1);
    expect(result.recommendation).toBeTruthy();
    expect(typeof result.recommendation).toBe("string");
  });

  it("handles empty tasks gracefully", () => {
    const emp = { ...baseEmployee, progress: 0 };
    const result = calculateRiskAssessment(emp, [], 0);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.risk_level).toBeDefined();
  });
});
