import { connectDB } from "@/lib/db";
import { Policy, PolicyChunk } from "@/lib/models";
import { requireAuth } from "./auth";
import { serializeDoc, serializeMany } from "@/lib/serialize";

export interface PolicyItem {
  id: string;
  title: string;
  content: string;
  category: string;
  version?: number;
  company_id?: string;
  created_at?: string;
  updated_at?: string;
}

export async function getCompanyPolicies() {
  const conn = await connectDB();
  if (!conn) return null;
  const user = await requireAuth();

  const policies = await Policy.find({ company_id: user.company_id })
    .select("title category created_at updated_at")
    .sort({ title: 1 })
    .lean();

  return serializeMany<PolicyItem>(policies as unknown as Record<string, unknown>[]);
}

export async function getPolicyById(id: string) {
  const conn = await connectDB();
  if (!conn) return null;
  const user = await requireAuth();

  const policy = await Policy.findOne({ _id: id, company_id: user.company_id }).lean();
  if (!policy) return null;
  return serializeDoc<PolicyItem>(policy as unknown as Record<string, unknown>);
}

export async function createPolicy(params: {
  title: string;
  content: string;
  category: string;
}): Promise<PolicyItem> {
  const user = await requireAuth();
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const policy = await Policy.create({
    company_id: user.company_id,
    title: params.title,
    content: params.content,
    category: params.category,
    version: 1,
  });

  return serializeDoc<PolicyItem>(policy.toObject() as unknown as Record<string, unknown>);
}

export async function updatePolicy(id: string, params: { title?: string; content?: string; category?: string }): Promise<PolicyItem> {
  const user = await requireAuth();
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const policy = await Policy.findOneAndUpdate(
    { _id: id, company_id: user.company_id },
    { $set: { ...params }, $inc: { version: 1 } },
    { new: true }
  ).lean();

  if (!policy) throw new Error("Policy not found");
  return serializeDoc<PolicyItem>(policy as unknown as Record<string, unknown>);
}

export async function deletePolicy(id: string) {
  const user = await requireAuth();
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  await Policy.deleteOne({ _id: id, company_id: user.company_id });
  await PolicyChunk.deleteMany({ policy_id: id }).catch(() => {});
}

export async function searchPolicies(query: string) {
  const conn = await connectDB();
  if (!conn) return null;
  const user = await requireAuth();

  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const policies = await Policy.find({
    company_id: user.company_id,
    $or: [{ title: regex }, { content: regex }],
  })
    .select("title content category")
    .limit(5)
    .lean();

  return serializeMany(policies);
}