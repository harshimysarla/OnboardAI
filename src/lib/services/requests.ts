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

  await ActivityLog.create({
    company_id: params.company_id,
    employee_id: params.employee_id || undefined,
    action: "Request created",
    details: `${params.type} request (${params.category})`,
  });

  return serializeDoc(request.toObject());
}

export async function updateRequestStatus(requestId: string, status: string) {
  const user = await requireAuth();
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  if (user.role === "employee") throw new Error("Only HR can update request status");

  const result = await SupportRequest.updateOne(
    { _id: requestId, company_id: user.company_id },
    { status }
  );
  if (result.matchedCount === 0) throw new Error("Request not found");

  await ActivityLog.create({
    company_id: user.company_id,
    employee_id: undefined,
    action: "Request status updated",
    details: `Request ${requestId} marked as ${status}`,
  });
}