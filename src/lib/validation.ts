import { z } from "zod";
import { NextResponse } from "next/server";

export const emailSchema = z.string().email("Invalid email address").min(1, "Email is required");
export const nonEmptyString = z.string().min(1, "This field is required");
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/, "Must be a valid date string");
export const uuidSchema = z.string().uuid("Must be a valid UUID");

// ─── Auth ───────────────────────────────────────────────────────────
export const accessCodeSchema = z
  .string()
  .min(3, "Company access code is required")
  .max(20, "Company access code must be 20 characters or fewer")
  .regex(/^[A-Za-z0-9_-]+$/, "Company access code may only contain letters, numbers, hyphens (-) and underscores (_)");

export const changeAccessCodeSchema = z.object({
  code: z
    .string()
    .min(3, "Company Access Code must be at least 3 characters")
    .max(20, "Company Access Code must be at most 20 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Company Access Code may only contain letters, numbers, hyphens (-) and underscores (_)")
    .optional(),
});

export const authSchema = z.object({
  company_code: accessCodeSchema,
  email: emailSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  full_name: nonEmptyString,
  email: emailSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
  company_name: nonEmptyString,
});

export const changePasswordSchema = z.object({
  new_password: z.string().min(6, "Password must be at least 6 characters"),
});

export const updateProfileSchema = z.object({
  phone: z.string().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
});

// ─── Chat ───────────────────────────────────────────────────────────
export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
  intent: z.string().optional(),
  intent_details: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string(),
});

export const chatSchema = z.object({
  messages: z.array(chatMessageSchema).min(1, "At least one message is required"),
  employeeId: z.string().optional(),
  employeeName: z.string().optional(),
});

// ─── Employees ──────────────────────────────────────────────────────
export const createEmployeeSchema = z.object({
  full_name: nonEmptyString,
  email: emailSchema,
  job_title: z.string().optional(),
  department: z.string().optional(),
  department_id: z.string().optional(),
  company_id: z.string().optional(),
  manager: z.string().optional(),
  joining_date: nonEmptyString,
});

// ─── Support Requests ───────────────────────────────────────────────
export const requestCategory = z.enum(["IT", "HR", "Access", "Equipment", "Documentation", "Other"]);
export const requestPriority = z.enum(["Low", "Medium", "High", "Urgent"]);
export const requestStatus = z.enum(["Open", "In Progress", "Resolved"]);

export const createRequestSchema = z.object({
  employee_id: nonEmptyString,
  employee_name: z.string().optional(),
  department: z.string().optional(),
  category: requestCategory,
  type: nonEmptyString,
  description: nonEmptyString,
  priority: requestPriority.optional().default("Medium"),
});

export const updateRequestSchema = z.object({
  id: nonEmptyString,
  status: requestStatus,
});

// ─── Tasks ──────────────────────────────────────────────────────────
export const completeTaskSchema = z.object({
  employee_id: nonEmptyString,
  task_id: nonEmptyString,
});

// ─── Policies ───────────────────────────────────────────────────────
export const policyCategory = z.enum(["HR", "IT", "Finance", "Security", "Operations", "Benefits", "Code of Conduct", "Other"]);

export const createPolicySchema = z.object({
  title: nonEmptyString,
  content: nonEmptyString,
  category: policyCategory.optional().default("Other"),
});

export const updatePolicySchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  category: policyCategory.optional(),
});

// ─── Policy Documents ───────────────────────────────────────────────
export const documentUploadSchema = z.object({
  title: z.string().min(1, "Title is required"),
});

// ─── Company ────────────────────────────────────────────────────────
export const updateCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens").optional(),
  logo_url: z.string().url().optional().or(z.literal("")),
});

export const createDepartmentSchema = z.object({
  name: nonEmptyString,
});

// ─── Onboarding ─────────────────────────────────────────────────────
export const taskCategory = z.enum(["day1", "first_week", "first_month", "custom"]);

export const createTemplateSchema = z.object({
  name: nonEmptyString,
  scope: z.enum(["company", "department", "role"]).optional().default("company"),
  department_id: z.string().optional(),
  role_pattern: z.string().optional(),
});

export const createTemplateTaskSchema = z.object({
  title: nonEmptyString,
  description: z.string().optional(),
  category: taskCategory.optional().default("first_week"),
  mandatory: z.boolean().optional().default(false),
  day_offset: z.number().int().min(0).optional().default(0),
  sort_order: z.number().int().min(0).optional().default(0),
});

export const updateTemplateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: taskCategory.optional(),
  mandatory: z.boolean().optional(),
  day_offset: z.number().int().min(0).optional(),
  sort_order: z.number().int().min(0).optional(),
});

// ─── Leaves ─────────────────────────────────────────────────────────
export const leaveType = z.enum(["annual", "sick", "casual", "unpaid", "other"]);
export const leaveStatus = z.enum(["pending", "hr_pending", "approved", "rejected", "cancelled"]);

export const applyLeaveSchema = z.object({
  leave_type: leaveType,
  start_date: nonEmptyString,
  end_date: nonEmptyString,
  reason: z.string().optional(),
});

export const decideLeaveSchema = z.object({
  id: nonEmptyString,
  decision: z.enum(["approve", "reject"]),
});

// ─── Search / Filters ───────────────────────────────────────────────
export const searchParamsSchema = z.object({
  q: z.string().optional(),
  department: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ─── Validation Helper ───────────────────────────────────────────────
export function validate<T>(schema: z.ZodType<T>, data: unknown): { data: T; error?: undefined } | { data?: undefined; error: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map(i => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return { error: NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 }) };
  }
  return { data: result.data };
}

export function validateQuery<T>(schema: z.ZodType<T>, searchParams: URLSearchParams): { data: T; error?: undefined } | { data?: undefined; error: NextResponse } {
  const obj: Record<string, string> = {};
  searchParams.forEach((value, key) => { obj[key] = value; });
  return validate(schema, obj);
}
