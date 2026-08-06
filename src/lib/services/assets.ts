import { connectDB } from "@/lib/db";
import { Asset, Employee } from "@/lib/models";
import { serializeDoc } from "@/lib/serialize";
import { Types } from "mongoose";
import type { AuthenticatedUser } from "@/lib/services/auth";

type AssetUser = Pick<AuthenticatedUser, "id" | "company_id" | "role" | "employee_id">;

export async function listAssets(user: AssetUser) {
  const conn = await connectDB();
  if (!conn) return null;

  if (user.role === "admin" || user.role === "hr") {
    const assets = await Asset.find({ company_id: user.company_id }).sort({ created_at: -1 }).lean();
    const empIds = [...new Set(assets.map((a) => a.assigned_to?.toString()).filter(Boolean))];
    const employees = empIds.length
      ? await Employee.find({ _id: { $in: empIds.map((id) => new Types.ObjectId(id)) } }).select("_id full_name").lean()
      : [];
    const empMap = new Map(employees.map((e) => [e._id.toString(), e.full_name]));
    const rows = assets.map((a) => ({
      ...serializeDoc(a as unknown as Record<string, unknown>),
      assigned_name: a.assigned_to ? empMap.get(a.assigned_to.toString()) || "Unknown" : "",
    }));
    return { assets: rows };
  }

  if (!user.employee_id) return { assets: [] };
  const assets = await Asset.find({
    company_id: user.company_id,
    assigned_to: user.employee_id,
  }).sort({ created_at: -1 }).lean();
  return { assets: (assets as unknown[]).map((a) => serializeDoc(a as Record<string, unknown>)) };
}

export async function createAsset(
  user: AssetUser,
  input: { name: string; type: string; serial_number?: string; notes?: string }
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  if (user.role !== "admin" && user.role !== "hr") throw new Error("Insufficient permissions");

  const doc = await Asset.create({
    company_id: user.company_id,
    name: input.name,
    type: input.type,
    serial_number: input.serial_number || "",
    notes: input.notes || "",
    status: "available",
  });
  return { asset: serializeDoc(doc.toObject()) };
}

export async function updateAsset(
  user: AssetUser,
  input: { id: string; name?: string; type?: string; serial_number?: string; status?: string; notes?: string; assigned_to?: string }
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  if (user.role !== "admin" && user.role !== "hr") throw new Error("Insufficient permissions");

  const doc = await Asset.findOne({ _id: input.id, company_id: user.company_id });
  if (!doc) return { error: "Asset not found" };

  if (input.name !== undefined) doc.name = input.name;
  if (input.type !== undefined) doc.type = input.type as never;
  if (input.serial_number !== undefined) doc.serial_number = input.serial_number;
  if (input.notes !== undefined) doc.notes = input.notes;

  if (input.status !== undefined) {
    doc.status = input.status as never;
    if (input.status === "available") {
      doc.assigned_to = undefined;
      doc.assigned_at = undefined;
    }
  }

  if (input.assigned_to !== undefined) {
    if (input.assigned_to) {
      if (!Types.ObjectId.isValid(input.assigned_to)) return { error: "Invalid employee" };
      const emp = await Employee.findOne({ _id: input.assigned_to, company_id: user.company_id }).lean();
      if (!emp) return { error: "Employee not found" };
      doc.assigned_to = new Types.ObjectId(input.assigned_to);
      doc.assigned_at = new Date();
      doc.status = "assigned" as never;
    } else {
      doc.assigned_to = undefined;
      doc.assigned_at = undefined;
      if (doc.status === "assigned") doc.status = "available" as never;
    }
  }

  await doc.save();
  return { asset: serializeDoc(doc.toObject()) };
}

export async function deleteAsset(user: AssetUser, id: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  if (user.role !== "admin" && user.role !== "hr") throw new Error("Insufficient permissions");
  const doc = await Asset.findOne({ _id: id, company_id: user.company_id });
  if (!doc) return { error: "Asset not found" };
  await Asset.deleteOne({ _id: doc._id });
  return { ok: true };
}