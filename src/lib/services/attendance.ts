import { connectDB } from "@/lib/db";
import { AttendanceRecord, Company, Employee } from "@/lib/models";
import { serializeDoc, serializeMany } from "@/lib/serialize";
import { Types } from "mongoose";
import { rewardCheckIn } from "./gamification";

function startOfLocalDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseTimeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToHHMM(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export { minutesToHHMM };

function currentTimeMin(): number {
  return new Date().getHours() * 60 + new Date().getMinutes();
}

async function requireEmployeeRecord(user: { id: string; company_id: string; employee_id?: string }) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  const employee = await Employee.findOne({ _id: user.employee_id, company_id: user.company_id }).lean();
  if (!employee) throw new Error("Employee profile not found");
  return employee;
}

async function getTodayRecord(user: { id: string; company_id: string; employee_id?: string }) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  const date = startOfLocalDay(new Date());
  let record = await AttendanceRecord.findOne({
    company_id: user.company_id,
    employee_id: user.employee_id,
    date,
  });
  if (!record) {
    try {
      record = await AttendanceRecord.create({
        company_id: user.company_id,
        employee_id: user.employee_id,
        user_id: user.id,
        date,
      });
    } catch (e) {
      if ((e as { code?: number })?.code !== 11000) throw e;
      record = await AttendanceRecord.findOne({
        company_id: user.company_id,
        employee_id: user.employee_id,
        date,
      });
    }
  }
  return record;
}

export async function checkIn(user: { id: string; company_id: string; employee_id?: string }) {
  await requireEmployeeRecord(user);
  const record = await getTodayRecord(user);
  if (record.check_in) {
    return { error: "Already checked in today" };
  }

  const company = await Company.findById(user.company_id).lean();
  const startTime =
    (company?.settings as { work_start_time?: string } | undefined)?.work_start_time || "09:30";
  const expectedMin = parseTimeToMin(startTime);
  const nowMin = currentTimeMin();
  const isLate = nowMin > expectedMin;
  const lateMinutes = isLate ? nowMin - expectedMin : 0;

  const now = new Date();
  const claimed = await AttendanceRecord.updateOne(
    { _id: record._id, check_in: null },
    { $set: { check_in: now, is_late: isLate, late_minutes: lateMinutes } }
  );
  if (claimed.modifiedCount === 0) {
    return { error: "Already checked in today" };
  }
  record.check_in = now;
  record.is_late = isLate;
  record.late_minutes = lateMinutes;
  if (user.employee_id) {
    await rewardCheckIn(user.company_id, user.id, user.employee_id);
  }
  return serializeDoc(record.toObject());
}

export async function checkOut(user: { id: string; company_id: string; employee_id?: string }) {
  await requireEmployeeRecord(user);
  const record = await getTodayRecord(user);
  if (!record.check_in) return { error: "Not checked in yet" };
  if (record.check_out) return { error: "Already checked out today" };

  const now = new Date();
  record.check_out = now;

  const breaks = (record.breaks || []).map((b: { start?: Date; end?: Date }) =>
    b.start && !b.end ? { ...b, end: now } : b
  );
  record.breaks = breaks;

  const breakSeconds = (breaks as { start: Date; end: Date }[]).reduce((sum, b) => {
    if (b.start && b.end) {
      return sum + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 1000;
    }
    return sum;
  }, 0);
  record.break_seconds = Math.round(Math.max(0, breakSeconds));
  record.work_seconds = Math.round(
    Math.max(0, new Date(record.check_out).getTime() - new Date(record.check_in).getTime()) / 1000 -
      record.break_seconds
  );

  await record.save();
  return serializeDoc(record.toObject());
}

export async function startBreak(user: { id: string; company_id: string; employee_id?: string }) {
  await requireEmployeeRecord(user);
  const record = await getTodayRecord(user);
  if (!record.check_in) return { error: "Not checked in yet" };
  const open = (record.breaks || []).find((b: { start?: Date; end?: Date }) => b.start && !b.end);
  if (open) return { error: "A break is already active" };

  record.breaks = [...(record.breaks || []), { start: new Date() }];
  await record.save();
  return serializeDoc(record.toObject());
}

export async function endBreak(user: { id: string; company_id: string; employee_id?: string }) {
  await requireEmployeeRecord(user);
  const record = await getTodayRecord(user);
  if (!record.check_in) return { error: "Not checked in yet" };
  const open = (record.breaks || []).find((b: { start?: Date; end?: Date }) => b.start && !b.end);
  if (!open) return { error: "No active break" };

  record.breaks = (record.breaks || []).map((b: { start?: Date; end?: Date }) =>
    b.start && !b.end ? { ...b, end: new Date() } : b
  );
  await record.save();
  return serializeDoc(record.toObject());
}

export async function getMyMonth(user: { id: string; company_id: string; employee_id?: string }, month?: string) {
  const conn = await connectDB();
  if (!conn) return null;
  await requireEmployeeRecord(user);

  const { start, end } = monthRange(month);
  const records = await AttendanceRecord.find({
    company_id: user.company_id,
    employee_id: user.employee_id,
    date: { $gte: start, $lt: end },
  }).sort({ date: 1 }).lean();

  return {
    records: serializeMany(records),
    summary: summarize(records as unknown as Record<string, unknown>[]),
  };
}

export async function getReport(
  companyId: string,
  opts: { month?: string; employeeId?: string } = {}
) {
  const conn = await connectDB();
  if (!conn) return null;
  const { start, end } = monthRange(opts.month);

  const query: Record<string, unknown> = {
    company_id: companyId,
    date: { $gte: start, $lt: end },
  };
  if (opts.employeeId && Types.ObjectId.isValid(opts.employeeId)) {
    query.employee_id = opts.employeeId;
  }

  const records = await AttendanceRecord.find(query).sort({ date: 1 }).lean();

  const employeeIds = [...new Set(records.map((r) => r.employee_id?.toString()).filter(Boolean))];
  const employees = await Employee.find({
    _id: { $in: employeeIds.map((id) => new Types.ObjectId(id)) },
    company_id: companyId,
  })
    .select("full_name email job_title department_id")
    .lean();
  const empMap = new Map(
    employees.map((e) => [e._id.toString(), { full_name: e.full_name, email: e.email, job_title: e.job_title }])
  );

  const rows = records.map((r) => ({
    ...serializeDoc(r as unknown as Record<string, unknown>),
    employee: empMap.get(r.employee_id?.toString()) || { full_name: "Unknown", email: "", job_title: "" },
  }));

  return { records: rows, summary: summarize(records) };
}

function monthRange(month?: string): { start: Date; end: Date } {
  const now = new Date();
  const parts =
    month && /^\d{4}-\d{2}$/.test(month) ? month.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const [y, m] = parts;
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

function summarize(records: Record<string, unknown>[]) {
  const withCheckIn = records.filter((r) => r.check_in);
  const present = withCheckIn.length;
  const totalWorkSeconds = records.reduce((s, r) => s + (Number(r.work_seconds) || 0), 0);
  const lateDays = records.filter((r) => r.is_late).length;
  const distinctDays = new Set(records.map((r) => toDateKey(new Date(r.date as string)))).size;
  return {
    present,
    absent: records.length ? Math.max(0, distinctDays - present) : 0,
    lateDays,
    totalHours: Math.round((totalWorkSeconds / 3600) * 100) / 100,
    avgHours: present ? Math.round((totalWorkSeconds / present / 3600) * 100) / 100 : 0,
    days: distinctDays,
  };
}