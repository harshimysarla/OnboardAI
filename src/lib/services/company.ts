import { connectDB } from "@/lib/db";
import { Company, ActivityLog, Notification, User } from "@/lib/models";
import {
  normalizeAccessCode,
  isValidCustomAccessCode,
  generateUniqueAccessCode,
} from "@/lib/access-code";

export const ACCESS_CODE_TAKEN_MESSAGE = "This Company Access Code is already taken.";
export const ACCESS_CODE_INVALID_MESSAGE =
  "Company Access Code must be 3-20 characters using only letters, numbers, hyphens (-) and underscores (_).";

export interface CompanyAdminUser {
  id: string;
  company_id: string;
  role: string;
  email?: string;
  full_name?: string;
}

/**
 * Changes a company's access code. Admin-only. Accepts a custom code from
 * the admin, or generates a fresh random one when none is provided.
 * Old code stops working immediately for future logins because login
 * always looks the code up in the database — no cached values involved.
 */
export async function updateCompanyAccessCode(
  user: CompanyAdminUser,
  input: { code?: string; ip?: string }
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  if (user.role !== "admin") throw new Error("Insufficient permissions");

  const company = await Company.findById(user.company_id).lean();
  if (!company) throw new Error("Company not found");

  const oldCode = company.access_code || "";

  let newCode: string;
  if (input.code !== undefined && input.code.trim() !== "") {
    newCode = normalizeAccessCode(input.code);
    if (!isValidCustomAccessCode(newCode)) {
      throw new Error(ACCESS_CODE_INVALID_MESSAGE);
    }
    // Globally unique — excluding this company's own record.
    const taken = await Company.findOne({
      access_code: newCode,
      _id: { $ne: company._id },
    }).lean();
    if (taken) throw new Error(ACCESS_CODE_TAKEN_MESSAGE);
  } else {
    newCode = await generateUniqueAccessCode(
      company.name,
      async (code) => !!(await Company.findOne({ access_code: code }).lean())
    );
  }

  if (newCode === oldCode) {
    return { access_code: newCode, old_code: oldCode, success: true };
  }

  try {
    await Company.updateOne({ _id: company._id }, { access_code: newCode });
  } catch (error: unknown) {
    // Unique-index race: another request claimed the code first.
    if ((error as { code?: number })?.code === 11000) {
      throw new Error(ACCESS_CODE_TAKEN_MESSAGE);
    }
    throw error;
  }

  await ActivityLog.create({
    company_id: company._id,
    action: "Company access code changed",
    details: `Company access code changed by ${
      user.full_name || user.email || "Admin"
    } from "${oldCode}" to "${newCode}".`,
    ip: input.ip || "",
  }).catch(() => {});

  // Notify every user in the company about the change.
  const recipients = await User.find({ company_id: company._id })
    .select("_id")
    .lean();
  if (recipients.length) {
    await Notification.insertMany(
      recipients.map((u) => ({
        company_id: company._id,
        user_id: u._id,
        title: "Company Access Code Updated",
        body: "The Company Access Code has been updated. Please use the new code for future logins.",
      }))
    ).catch((e) => console.error("Notification insert failed:", e));
  }

  return { access_code: newCode, old_code: oldCode, success: true };
}
