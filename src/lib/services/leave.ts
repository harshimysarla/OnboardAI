import { connectDB } from "@/lib/db";
import { LeaveRequest, LeaveBalance, Employee } from "@/lib/models";
import { serializeDoc, serializeMany } from "@/lib/serialize";
import { Types } from "mongoose";
import type { AuthenticatedUser } from "@/lib/services/auth";

type LeaveUser = Pick<AuthenticatedUser, "id" | "company_id" | "employee_id" | "role" | "full_name">;

const DEFAULT_BALANCES: Record<string, number> = { annual: 20, sick: 10, casual: 5, unpaid: 0, other: 0 };

function daysBetween(start: Date, end: Date): number {
  let count = 0;
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor <= last) {
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function parseDate(value: string): Date {
  const d = new Date(value);
  return d;
}

async function ensureBalance(
  companyId: string,
  employeeId: string
): Promise<Record<string, unknown>> {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  let balance = await LeaveBalance.findOne({ company_id: companyId, employee_id: employeeId });
  if (!balance) {
    balance = await LeaveBalance.create({ company_id: companyId, employee_id: employeeId });
  }
  return balance.toObject();
}

async function requireEmployeeRecord(user: { id: string; company_id: string; employee_id?: string }) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  const employee = await Employee.findOne({ _id: user.employee_id, company_id: user.company_id }).lean();
  if (!employee) throw new Error("Employee profile not found");
  return employee;
}

export async function applyLeave(user: LeaveUser, input: { leave_type: string; start_date: string; end_date: string; reason?: string }) {
  await requireEmployeeRecord(user);

  const start = parseDate(input.start_date);
  const end = parseDate(input.end_date);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { error: "Invalid dates" };
  if (start > end) return { error: "Start date must be before end date" };

  const days = daysBetween(start, end);
  if (days <= 0) return { error: "No working days in the requested period" };

  const overlap = await LeaveRequest.findOne({
    company_id: user.company_id,
    employee_id: user.employee_id,
    status: { $in: ["pending", "hr_pending", "approved"] },
    start_date: { $lte: end },
    end_date: { $gte: start },
  }).lean();
  if (overlap) return { error: "You already have a leave request in this period" };

  const leaveType = input.leave_type as string;
  const balance = await ensureBalance(user.company_id, user.employee_id!);
  if (leaveType !== "unpaid" && leaveType !== "other") {
    const available = availableOf(balance, leaveType);
    if (days > available) return { error: `Insufficient ${leaveType} leave balance (${available} days available)` };
  }

  const request = await LeaveRequest.create({
    company_id: user.company_id,
    employee_id: user.employee_id,
    user_id: user.id,
    leave_type: leaveType,
    start_date: start,
    end_date: end,
    days,
    reason: input.reason || "",
    status: "pending",
  });

  return serializeDoc(request.toObject());
}

export async function cancelLeave(user: LeaveUser, requestId: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  const request = await LeaveRequest.findOne({
    _id: requestId,
    company_id: user.company_id,
    employee_id: user.employee_id,
  });
  if (!request) return { error: "Leave request not found" };
  if (!["pending", "hr_pending"].includes(request.status)) return { error: "Only pending requests can be cancelled" };

  request.status = "cancelled";
  await request.save();
  return serializeDoc(request.toObject());
}

export async function getMyLeaves(user: LeaveUser) {
  const conn = await connectDB();
  if (!conn) return null;

  const requests = await LeaveRequest.find({
    company_id: user.company_id,
    employee_id: user.employee_id,
  })
    .sort({ created_at: -1 })
    .lean();

  const balance = await ensureBalance(user.company_id, user.employee_id!);
  const balances = {
    annual: {
      total: Number(balance.annual_total ?? DEFAULT_BALANCES.annual),
      used: Number(balance.annual_used ?? 0),
      available: availableOf(balance, "annual"),
    },
    sick: {
      total: Number(balance.sick_total ?? DEFAULT_BALANCES.sick),
      used: Number(balance.sick_used ?? 0),
      available: availableOf(balance, "sick"),
    },
    casual: {
      total: Number(balance.casual_total ?? DEFAULT_BALANCES.casual),
      used: Number(balance.casual_used ?? 0),
      available: availableOf(balance, "casual"),
    },
    unpaid: {
      total: Number(balance.unpaid_total ?? 0),
      used: Number(balance.unpaid_used ?? 0),
      available: availableOf(balance, "unpaid"),
    },
    other: {
      total: Number(balance.other_total ?? 0),
      used: Number(balance.other_used ?? 0),
      available: availableOf(balance, "other"),
    },
  };

  return { requests: serializeMany(requests), balances };
}

function availableOf(balance: Record<string, unknown>, leaveType: string) {
  const total = Number(balance[`${leaveType}_total`] ?? DEFAULT_BALANCES[leaveType] ?? 0);
  const used = Number(balance[`${leaveType}_used`] ?? 0);
  return Math.max(0, total - used);
}

export async function getPendingLeaves(user: LeaveUser) {
  const conn = await connectDB();
  if (!conn) return null;

  const isManager = user.role === "manager";
  const canSeeAll = ["admin", "hr"].includes(user.role);

  if (!isManager && !canSeeAll) return [];

  // Direct reports are employees whose `manager` field equals this user's full name.
  let managerNames: string[] = [];
  if (isManager) {
    managerNames = [user.full_name];
  }

  const employeeQuery: Record<string, unknown> = { company_id: user.company_id };
  if (managerNames.length) employeeQuery.manager = { $in: managerNames };
  const employees = await Employee.find(employeeQuery).select("_id full_name email").lean();
  const employeeIds = employees.map((e) => e._id);

  const query: Record<string, unknown> = {
    company_id: user.company_id,
    status: { $in: ["pending", "hr_pending"] },
  };
  if (employeeIds.length) {
    query.employee_id = { $in: employeeIds };
  } else if (isManager) {
    return [];
  }

  const requests = await LeaveRequest.find(query).sort({ created_at: -1 }).lean();

  const empMap = new Map(employees.map((e) => [e._id.toString(), e]));
  const rows = requests.map((r) => {
    const emp = r.employee_id ? empMap.get(r.employee_id.toString()) : undefined;
    return {
      ...serializeDoc(r),
      employee: emp
        ? { id: emp._id.toString(), full_name: emp.full_name, email: emp.email }
        : null,
    };
  });

  const hrPending = requests.filter((r) => r.status === "hr_pending").length;
  return { requests: rows, canApproveFinal: canSeeAll, pendingCount: rows.length, hrPendingCount: hrPending };
}

export async function decideLeave(user: LeaveUser, requestId: string, decision: "approve" | "reject") {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const request = await LeaveRequest.findOne({ _id: requestId, company_id: user.company_id });
  if (!request) return { error: "Leave request not found" };
  if (!["pending", "hr_pending"].includes(request.status)) return { error: "This request has already been decided" };

  const isFinal = ["admin", "hr"].includes(user.role);
  const isManager = user.role === "manager";

  if (isManager && !isFinal) {
    const requester = await Employee.findOne({ _id: request.employee_id, company_id: user.company_id }).lean();
    if (!requester || requester.manager !== user.full_name) return { error: "You can only act on your team's requests" };
  }

  if (decision === "reject") {
    request.status = "rejected";
    request.decided_by = user.id;
    request.decided_at = new Date();
    await request.save();
    return serializeDoc(request.toObject());
  }

  // Approve path
  if (isFinal) {
    request.status = "approved";
    request.decided_by = user.id;
    request.decided_at = new Date();

    const balance = await ensureBalance(user.company_id, request.employee_id.toString());
    const leaveType = request.leave_type as string;
    await LeaveBalance.updateOne(
      { _id: balance._id },
      { $inc: { [`${leaveType}_used`]: request.days } }
    );
    await request.save();
    return serializeDoc(request.toObject());
  }

  // Manager approves first step -> moves to HR pending
  request.status = "hr_pending";
  request.decided_by = user.id;
  request.decided_at = new Date();
  await request.save();
  return serializeDoc(request.toObject());
}

// Analytics for admin/hr dashboards
export async function getLeaveAnalytics(user: LeaveUser) {
  const conn = await connectDB();
  if (!conn) return null;
  if (!["admin", "hr"].includes(user.role)) return null;

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

  const [total, month, byType, pendingCount] = await Promise.all([
    LeaveRequest.countDocuments({ company_id: user.company_id }),
    LeaveRequest.countDocuments({ company_id: user.company_id, created_at: { $gte: startOfMonth, $lt: nextMonth } }),
    LeaveRequest.aggregate([
      { $match: { company_id: new Types.ObjectId(user.company_id) } },
      { $group: { _id: "$leave_type", count: { $sum: 1 }, days: { $sum: "$days" } } },
    ]),
    LeaveRequest.countDocuments({ company_id: user.company_id, status: { $in: ["pending", "hr_pending"] } }),
  ]);

  return {
    total,
    thisMonth: month,
    pending: pendingCount,
    byType: byType.map((b) => ({ type: b._id, count: b.count, days: b.days })),
  };
}