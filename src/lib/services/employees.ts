import { connectDB } from "@/lib/db";
import { Employee, Department, OnboardingTemplate, EmployeeTask, ActivityLog, User, Company, Invitation } from "@/lib/models";
import { requireAuth } from "./auth";
import { serializeDoc, serializeMany, toId } from "@/lib/serialize";
import { hashPassword } from "./auth";
import { Types } from "mongoose";
import crypto from "crypto";

async function withDepartment(emp: Record<string, unknown>): Promise<Record<string, unknown>> {
  const ser = serializeDoc<Record<string, unknown>>(emp);
  const deptId = emp.department_id;
  if (deptId) {
    const dept = await Department.findById(deptId).lean();
    ser.department = dept?.name || "";
  } else {
    ser.department = "";
  }
  return ser;
}

export async function getEmployees() {
  const conn = await connectDB();
  if (!conn) return null;
  const user = await requireAuth();

  const employees = await Employee.find({ company_id: user.company_id })
    .sort({ created_at: -1 })
    .lean();

  const result = [];
  for (const emp of employees) {
    result.push(await withDepartment(emp as unknown as Record<string, unknown>));
  }
  return result;
}

export async function getEmployeeById(id: string) {
  const conn = await connectDB();
  if (!conn) return null;
  const user = await requireAuth();

  const emp = await Employee.findOne({ _id: id, company_id: user.company_id }).lean();
  if (!emp) return null;
  return withDepartment(emp as unknown as Record<string, unknown>);
}

export async function getMyProfile() {
  const conn = await connectDB();
  if (!conn) return null;
  const user = await requireAuth();

  const emp = await Employee.findOne({ user_id: user.id }).lean();
  if (!emp) return null;
  return withDepartment(emp as unknown as Record<string, unknown>);
}

export async function getOnboardingTemplate(companyId: string) {
  const conn = await connectDB();
  if (!conn) return null;

  let template = await OnboardingTemplate.findOne({
    company_id: companyId,
    scope: "company",
  }).lean();

  if (!template) {
    template = (
      await OnboardingTemplate.create({
        company_id: companyId,
        name: "Default Onboarding",
        scope: "company",
        tasks: [],
      })
    ).toObject() as unknown as Record<string, unknown>;
  }

  const tasks = ((template.tasks as Record<string, unknown>[]) || []).map((t) =>
    serializeDoc<Record<string, unknown>>({
      ...t,
      _id: t._id || t.id,
    })
  );

  return { template: serializeDoc(template), tasks };
}

export async function createEmployee(params: {
  full_name: string;
  email: string;
  job_title: string;
  department_id: string;
  company_id: string;
  manager: string;
  joining_date: string;
}) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  const user = await requireAuth();

  if (user.role !== "admin" && user.role !== "hr") {
    throw new Error("Insufficient permissions");
  }

  const company = await Company.findById(params.company_id).lean();
  if (!company) throw new Error("Company not found");

  const existing = await User.findOne({ email: params.email.toLowerCase() }).lean();
  let userId: string;
  let isNewUser = false;
  let tempPassword = "";

  if (existing) {
    userId = toId(existing._id);
    await User.updateOne({ _id: existing._id }, { company_id: params.company_id });
  } else {
    tempPassword = cryptoRandomPassword();
    const userRec = await User.create({
      email: params.email.toLowerCase(),
      password_hash: await hashPassword(tempPassword),
      full_name: params.full_name,
      role: "employee",
      company_id: params.company_id,
      must_change_password: true,
    });
    userId = toId(userRec._id);
    isNewUser = true;
    console.log(`[onboardai] Temporary password for ${params.email}: ${tempPassword}`);
  }

  // Record invitation for new users
  if (isNewUser) {
    await Invitation.create({
      company_id: params.company_id,
      email: params.email.toLowerCase(),
      user_id: userId,
      invited_by: user.id,
      status: "pending",
      access_code: (company as Record<string, unknown>).access_code || "",
    });
  }

  let deptId: string | null = null;
  if (params.department_id) {
    const raw = params.department_id;
    let dept = Types.ObjectId.isValid(raw)
      ? await Department.findById(raw).lean()
      : null;
    if (!dept && !Types.ObjectId.isValid(raw)) {
      dept = await Department.findOne({
        company_id: params.company_id,
        name: raw,
      }).lean();
    }
    if (!dept) {
      dept = (
        await Department.create({ company_id: params.company_id, name: raw })
      ).toObject();
    }
    deptId = dept ? toId(dept._id) : null;
  }

  const employee = await Employee.create({
    company_id: params.company_id,
    user_id: userId,
    department_id: deptId || undefined,
    full_name: params.full_name,
    email: params.email.toLowerCase(),
    job_title: params.job_title || params.full_name,
    manager: params.manager || "",
    joining_date: new Date(params.joining_date),
    progress: 0,
    risk_level: "green",
  });

  const empId = toId(employee._id);

  const templateData = await getOnboardingTemplate(params.company_id);
  const templateTasks = templateData?.tasks || [];

  if (templateTasks.length > 0) {
    const employeeTasks = templateTasks.map((t: Record<string, unknown>) => {
      const dueDate = new Date(params.joining_date);
      const category = t.category || "day1";
      if (category === "first_week") dueDate.setDate(dueDate.getDate() + 7);
      else if (category === "first_month") dueDate.setDate(dueDate.getDate() + 30);
      return {
        employee_id: empId,
        company_id: params.company_id,
        title: t.title,
        description: t.description || "",
        category,
        mandatory: t.mandatory !== false,
        completed: false,
        due_date: dueDate,
        sort_order: t.sort_order || 0,
      };
    });
    try {
      await EmployeeTask.insertMany(employeeTasks);
    } catch (taskError) {
      console.error("Failed to assign tasks:", taskError);
    }
  }

  await ActivityLog.create({
    company_id: params.company_id,
    employee_id: empId,
    action: "Employee created",
    details: `${params.full_name} was added as ${params.job_title}`,
  });

  return serializeDoc({
    ...employee.toObject(),
    department: deptId ? (await Department.findById(deptId).lean())?.name || "" : "",
    department_id: deptId || "",
    temporary_password: tempPassword || undefined,
  });
}

export async function updateEmployeeProgress(employeeId: string, companyId: string) {
  const conn = await connectDB();
  if (!conn) return;

  const tasks = await EmployeeTask.find({ employee_id: employeeId });
  if (!tasks || tasks.length === 0) return;

  const completed = tasks.filter((t) => t.completed).length;
  const progress = Math.round((completed / tasks.length) * 100);

  await Employee.updateOne(
    { _id: employeeId, company_id: companyId },
    { progress }
  );
}

export async function listDepartments(companyId: string) {
  const conn = await connectDB();
  if (!conn) return [];
  const depts = await Department.find({ company_id: companyId }).sort({ name: 1 }).lean();
  return serializeMany(depts);
}

export async function createDepartment(companyId: string, name: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  const existing = await Department.findOne({ company_id: companyId, name });
  if (existing) return serializeDoc(existing.toObject());
  const dept = await Department.create({ company_id: companyId, name });
  return serializeDoc(dept.toObject());
}

export async function listInvitations(companyId: string) {
  const conn = await connectDB();
  if (!conn) return [];
  const docs = await Invitation.find({ company_id: companyId })
    .populate("invited_by", "full_name email")
    .sort({ created_at: -1 })
    .lean();
  return docs.map((doc) => ({
    ...serializeDoc(doc as unknown as Record<string, unknown>),
    invited_by_name: (doc.invited_by as unknown as Record<string, string> | undefined)?.full_name || "",
  }));
}

function cryptoRandomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.randomBytes(12) as Buffer;
  let pw = "";
  for (let i = 0; i < 12; i++) {
    pw += chars[bytes[i] % chars.length];
  }
  return pw;
}