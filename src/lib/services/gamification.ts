import { connectDB } from "@/lib/db";
import { Employee, Notification, EmployeeTask, Department } from "@/lib/models";
import type { AuthenticatedUser } from "@/lib/services/auth";

type GameUser = Pick<AuthenticatedUser, "id" | "company_id" | "employee_id" | "full_name">;

export interface BadgeDef {
  code: string;
  title: string;
  description: string;
  icon: string;
  points: number;
}

export const BADGE_CATALOG: BadgeDef[] = [
  { code: "onboarding-complete", title: "Onboarded", description: "Complete all mandatory onboarding tasks", icon: "rocket", points: 50 },
  { code: "first-checkin", title: "Day One", description: "Check in to attendance for the first time", icon: "clock", points: 10 },
  { code: "streak-5", title: "On Fire", description: "Build a 5-day attendance streak", icon: "flame", points: 30 },
  { code: "quiz-pass", title: "Quiz Ace", description: "Pass a training quiz", icon: "check", points: 20 },
  { code: "first-course", title: "Graduate", description: "Finish your first training course", icon: "graduation", points: 40 },
  { code: "policy-signed", title: "Policy Pro", description: "Accept company policies", icon: "file", points: 15 },
];

export const POINTS = {
  task: 5,
  check_in: 5,
  quiz_pass: 10,
  course_complete: 20,
};

function startOfLocalDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

async function findEmployee(user: GameUser) {
  const conn = await connectDB();
  if (!conn) return null;
  if (!user.employee_id) return null;
  return Employee.findOne({ _id: user.employee_id, company_id: user.company_id });
}

export async function getGamification(user: GameUser) {
  const conn = await connectDB();
  if (!conn) return null;

  const emp = await findEmployee(user);
  if (!emp) return { points: 0, badges: [], rank: 0, total: 0, leaderboard: [], catalog: BADGE_CATALOG.map((b) => ({ ...b, earned: false })) };

  const employees = await Employee.find({ company_id: user.company_id, user_id: { $ne: null } })
    .select("full_name points badges current_streak best_streak department_id")
    .sort({ points: -1 })
    .lean();

  const deptIds = [...new Set(employees.map((e) => e.department_id?.toString()).filter(Boolean))];
  const departments = deptIds.length
    ? await Department.find({ _id: { $in: deptIds } }).select("_id name").lean()
    : [];
  const deptMap = new Map(departments.map((d) => [d._id.toString(), d.name]));

  const myEmpId = user.employee_id;
  const me = employees.findIndex((e) => e._id.toString() === myEmpId);
  const earned = new Set((emp.badges || []).map((b: { code: string }) => b.code));

  const leaderboard = employees.map((e) => ({
    id: e._id.toString(),
    full_name: e.full_name,
    points: e.points || 0,
    badges: (e.badges || []).length,
    streak: e.current_streak || 0,
    department: e.department_id ? deptMap.get(e.department_id.toString()) || "" : "",
    is_me: e._id.toString() === myEmpId,
  }));

  return {
    points: emp.points || 0,
    badges: (emp.badges || []).map((b: { code: string; awarded_at: string }) => ({
      ...BADGE_CATALOG.find((x) => x.code === b.code),
      code: b.code,
      awarded_at: b.awarded_at,
    })),
    rank: me === -1 ? 0 : me + 1,
    total: employees.length,
    leaderboard,
    catalog: BADGE_CATALOG.map((b) => ({ ...b, earned: earned.has(b.code) })),
  };
}

async function reward(
  companyId: string,
  userId: string,
  employeeId: string,
  opts: { points?: number; badgeCode?: string; reason: string }
) {
  try {
    const conn = await connectDB();
    if (!conn) return;
    const emp = await Employee.findOne({ _id: employeeId, company_id: companyId });
    if (!emp) return;

    const owned = new Set(((emp.badges as { code: string }[]) || []).map((b) => b.code));
    let points = opts.points || 0;

    const def = opts.badgeCode && !owned.has(opts.badgeCode)
      ? BADGE_CATALOG.find((b) => b.code === opts.badgeCode)
      : undefined;

    if (def) {
      const claimed = await Employee.updateOne(
        { _id: employeeId, company_id: companyId, "badges.code": { $ne: def.code } },
        { $push: { badges: { code: def.code, awarded_at: new Date() } } }
      );
      if (claimed.modifiedCount === 1) {
        points += def.points;
        await Notification.create({
          company_id: companyId,
          user_id: userId,
          title: `Badge earned: ${def.title}`,
          body: `You earned the "${def.title}" badge (+${def.points} points). ${def.description}`,
        }).catch(() => {});
      }
    }

    if (points > 0) {
      await Employee.updateOne({ _id: employeeId, company_id: companyId }, { $inc: { points } });
    }
  } catch (e) {
    console.error("Gamification reward failed:", e);
  }
}

export async function rewardTaskComplete(companyId: string, employeeId: string) {
  const conn = await connectDB();
  if (!conn) return;
  const emp = await Employee.findOne({ _id: employeeId, company_id: companyId });
  if (!emp || !emp.user_id) return;

  await reward(companyId, emp.user_id.toString(), employeeId, { points: POINTS.task, reason: "Task completed" });

  const tasks = await EmployeeTask.find({ employee_id: employeeId, company_id: companyId }).lean();
  const mandatory = tasks.filter((t) => t.mandatory);
  if (mandatory.length && mandatory.every((t) => t.completed)) {
    await reward(companyId, emp.user_id.toString(), employeeId, { badgeCode: "onboarding-complete", reason: "Mandatory onboarding tasks done" });
  }
}

export async function rewardCheckIn(companyId: string, userId: string, employeeId: string) {
  const conn = await connectDB();
  if (!conn) return;
  const emp = await Employee.findOne({ _id: employeeId, company_id: companyId });
  if (!emp) return;

  const today = startOfLocalDay(new Date());
  const last = emp.last_attendance_date ? new Date(emp.last_attendance_date) : null;
  if (last && startOfLocalDay(last).getTime() === today.getTime()) return; // already rewarded today

  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const streak = last && startOfLocalDay(last).getTime() === yesterday.getTime() ? (emp.current_streak || 0) + 1 : 1;

  // Atomic claim so concurrent check-ins can't double-reward
  const claimed = await Employee.updateOne(
    { _id: employeeId, company_id: companyId, last_attendance_date: { $ne: today } },
    {
      $set: {
        current_streak: streak,
        best_streak: Math.max(emp.best_streak || 0, streak),
        last_attendance_date: today,
      },
    }
  );
  if (claimed.modifiedCount === 0) return;

  const hadCheckInBadge = ((emp.badges || []) as { code: string }[]).some((b) => b.code === "first-checkin");
  if (!hadCheckInBadge) {
    await reward(companyId, userId, employeeId, { badgeCode: "first-checkin", reason: "First check-in" });
  }
  await reward(companyId, userId, employeeId, { points: POINTS.check_in, reason: "Daily check-in" });
  if (streak === 5) {
    await reward(companyId, userId, employeeId, { badgeCode: "streak-5", reason: "5-day streak" });
  }
}

export async function rewardQuizPass(user: GameUser) {
  if (!user.employee_id) return;
  await reward(user.company_id, user.id, user.employee_id, {
    points: POINTS.quiz_pass,
    badgeCode: "quiz-pass",
    reason: "Quiz passed",
  });
}

export async function rewardCourseComplete(user: GameUser) {
  if (!user.employee_id) return;
  await reward(user.company_id, user.id, user.employee_id, {
    points: POINTS.course_complete,
    badgeCode: "first-course",
    reason: "Course completed",
  });
}

export async function rewardPolicySigned(userId: string) {
  const conn = await connectDB();
  if (!conn) return;
  const emp = await Employee.findOne({ user_id: userId }).select("_id company_id");
  if (!emp) return;
  await reward(emp.company_id.toString(), userId, emp._id.toString(), { badgeCode: "policy-signed", reason: "Policies accepted" });
}
