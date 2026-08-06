import { connectDB } from "@/lib/db";
import { Employee, Department, CompanyEvent } from "@/lib/models";
import { serializeDoc } from "@/lib/serialize";
import type { AuthenticatedUser } from "@/lib/services/auth";

type DirUser = Pick<AuthenticatedUser, "company_id" | "role">;

// ─── Directory ──────────────────────────────────────────────────────
export async function getDirectory(user: DirUser, q?: string) {
  const conn = await connectDB();
  if (!conn) return null;

  const employees = await Employee.find({ company_id: user.company_id }).sort({ full_name: 1 }).lean();
  const deptIds = [...new Set(employees.map((e) => e.department_id?.toString()).filter(Boolean))];
  const departments = deptIds.length
    ? await Department.find({ _id: { $in: deptIds } }).select("_id name").lean()
    : [];
  const deptMap = new Map(departments.map((d) => [d._id.toString(), d.name]));

  const rows: { full_name: string; email: string; job_title: string; department: string; [key: string]: unknown }[] = employees.map((e) => ({
    ...serializeDoc(e as unknown as Record<string, unknown>),
    department: e.department_id ? deptMap.get(e.department_id.toString()) || "" : "",
  }) as { full_name: string; email: string; job_title: string; department: string; [key: string]: unknown });

  // Filter by department name (regex on populated field)
  if (q && q.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    return rows.filter(
      (r) => rx.test(r.full_name as string) || rx.test(r.email as string) || rx.test(r.job_title as string) || rx.test(r.department as string)
    );
  }
  return rows;
}

// ─── Calendar ───────────────────────────────────────────────────────
export async function getCalendar(user: DirUser, month?: string) {
  const conn = await connectDB();
  if (!conn) return null;

  const now = new Date();
  const parts =
    month && /^\d{4}-\d{2}$/.test(month)
      ? month.split("-").map(Number)
      : [now.getFullYear(), now.getMonth() + 1];
  const [y, m] = parts;
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));

  const events = await CompanyEvent.find({
    company_id: user.company_id,
    $or: [
      { date: { $gte: start, $lt: end } },
      { recurring: true },
    ],
  }).sort({ date: 1 }).lean();

  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const ev of events) {
    const d = new Date(ev.date);
    const base = (ev as { recurring?: boolean }).recurring ? new Date(Date.UTC(y, m - 1, d.getUTCDate())) : d;
    if (base >= start && base < end) {
      const key = `${ev._id}-${base.toISOString()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ ...serializeDoc(ev as unknown as Record<string, unknown>), date: base });
    }
  }

  // Birthdays + anniversaries derived from employees
  const employees = await Employee.find({ company_id: user.company_id }).select("full_name joining_date").lean();
  for (const emp of employees) {
    const jd = new Date(emp.joining_date);
    const birthdays = [new Date(Date.UTC(y, m - 1, jd.getUTCDate()))];
    const anniversaries = [new Date(Date.UTC(y, m - 1, jd.getUTCDate()))];
    for (const bd of birthdays) {
      if (bd >= start && bd < end) {
        rows.push({
          id: `bday-${emp._id}`,
          title: `${emp.full_name}'s birthday`,
          type: "birthday",
          date: bd,
          all_day: true,
          time: "",
          location: "",
          notes: "",
          recurring: true,
        });
      }
    }
    for (const an of anniversaries) {
      if (an >= start && an < end) {
        const years = y - jd.getUTCFullYear();
        if (years >= 1) {
          rows.push({
            id: `anniv-${emp._id}`,
            title: `${emp.full_name}'s ${years}${years === 1 ? "st" : years === 2 ? "nd" : years === 3 ? "rd" : "th"} anniversary`,
            type: "anniversary",
            date: an,
            all_day: true,
            time: "",
            location: "",
            notes: "",
            recurring: true,
          });
        }
      }
    }
  }

  rows.sort((a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime());
  return { events: rows, month: `${y}-${String(m).padStart(2, "0")}` };
}

export async function createEvent(
  user: DirUser & { id: string },
  input: { title: string; type: string; date: string; all_day?: boolean; time?: string; location?: string; notes?: string; recurring?: boolean }
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  if (user.role !== "admin" && user.role !== "hr") throw new Error("Insufficient permissions");

  const date = new Date(input.date);
  if (isNaN(date.getTime())) return { error: "Invalid date" };

  const doc = await CompanyEvent.create({
    company_id: user.company_id,
    title: input.title,
    type: input.type,
    date,
    all_day: input.all_day !== false,
    time: input.time || "",
    location: input.location || "",
    notes: input.notes || "",
    recurring: !!input.recurring,
    created_by: user.id,
  });
  return { event: serializeDoc(doc.toObject()) };
}

export async function updateEvent(
  user: DirUser & { id: string },
  input: { id: string; title?: string; type?: string; date?: string; all_day?: boolean; time?: string; location?: string; notes?: string; recurring?: boolean }
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  if (user.role !== "admin" && user.role !== "hr") throw new Error("Insufficient permissions");

  const doc = await CompanyEvent.findOne({ _id: input.id, company_id: user.company_id });
  if (!doc) return { error: "Event not found" };

  if (input.title !== undefined) doc.title = input.title;
  if (input.type !== undefined) doc.type = input.type as never;
  if (input.date !== undefined) {
    const date = new Date(input.date);
    if (isNaN(date.getTime())) return { error: "Invalid date" };
    doc.date = date;
  }
  if (input.all_day !== undefined) doc.all_day = input.all_day;
  if (input.time !== undefined) doc.time = input.time;
  if (input.location !== undefined) doc.location = input.location;
  if (input.notes !== undefined) doc.notes = input.notes;
  if (input.recurring !== undefined) doc.recurring = input.recurring;
  await doc.save();
  return { event: serializeDoc(doc.toObject()) };
}

export async function deleteEvent(user: DirUser & { id: string }, id: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  if (user.role !== "admin" && user.role !== "hr") throw new Error("Insufficient permissions");
  const doc = await CompanyEvent.findOne({ _id: id, company_id: user.company_id });
  if (!doc) return { error: "Event not found" };
  await CompanyEvent.deleteOne({ _id: doc._id });
  return { ok: true };
}