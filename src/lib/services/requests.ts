import { connectDB } from "@/lib/db";
import { SupportRequest, ActivityLog } from "@/lib/models";
import { requireAuth } from "./auth";
import { serializeDoc, serializeMany } from "@/lib/serialize";

export async function getSupportRequests() {
  const conn = await connectDB();
  if (!conn) return null;
  const user = await requireAuth();

  const query: Record<string, unknown> = { company_id: user.company_id };
  if (user.role === "employee" && user.employee_id) {
    query.employee_id = user.employee_id;
  }

  const requests = await SupportRequest.find(query).sort({ created_at: -1 }).lean();
  return serializeMany(requests);
}

export async function createSupportRequest(params: {
  employee_id: string;
  company_id: string;
  employee_name: string;
  department: string;
  category: string;
  type: string;
  description: string;
  priority: string;
}) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const request = await SupportRequest.create({
    company_id: params.company_id,
    employee_id: params.employee_id || undefined,
    employee_name: params.employee_name,
    department: params.department,
    category: params.category,
    type: params.type,
    description: params.description,
    priority: params.priority,
    status: "Open",
  });

  try {
    await ActivityLog.create({
      company_id: params.company_id,
      employee_id: params.employee_id || undefined,
      action: "Request created",
      details: `${params.type} request (${params.category})`,
    });
  } catch (logError) {
    console.error("Failed to record activity log:", logError);
  }

  return serializeDoc(request.toObject());
}

export async function updateRequestStatus(requestId: string, status: string) {
  const user = await requireAuth();
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  if (user.role === "employee") throw new Error("Only HR can update request status");

  const existing = await SupportRequest.findOne({
    _id: requestId,
    company_id: user.company_id,
  })
    .select("employee_id type category")
    .lean();
  if (!existing) throw new Error("Request not found");

  await SupportRequest.updateOne(
    { _id: requestId, company_id: user.company_id },
    { status }
  );

  try {
    await ActivityLog.create({
      company_id: user.company_id,
      employee_id: (existing.employee_id as string | undefined) || undefined,
      action: "Request status updated",
      details: `Request "${existing.type}" (${existing.category}) marked as ${status}`,
    });
  } catch (logError) {
    console.error("Failed to record activity log:", logError);
  }
}