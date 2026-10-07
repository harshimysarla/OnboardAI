import { connectDB } from "@/lib/db";
import { ActivityLog } from "@/lib/models";
import { requireRole } from "./auth";
import { serializeMany } from "@/lib/serialize";

export async function logAction(company_id: string, employee_id: string | null | undefined, action: string, details: string = "", ip: string = "") {
  try {
    const conn = await connectDB();
    if (!conn) return;

    await ActivityLog.create({
      company_id,
      employee_id: employee_id || undefined,
      action,
      details,
      ip
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

export async function getLogs(limit: number = 50) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  
  const user = await requireRole("admin", "hr");

  const logs = await ActivityLog.find({ company_id: user.company_id })
    .sort({ created_at: -1 })
    .limit(limit)
    .populate("employee_id", "full_name email")
    .lean();

  return serializeMany(logs);
}
