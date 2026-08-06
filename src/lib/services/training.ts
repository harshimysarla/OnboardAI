import { connectDB } from "@/lib/db";
import { TrainingCourse, TrainingAssignment, Employee } from "@/lib/models";
import { serializeDoc } from "@/lib/serialize";
import { Types } from "mongoose";
import type { AuthenticatedUser } from "@/lib/services/auth";
import { rewardQuizPass, rewardCourseComplete } from "./gamification";
import crypto from "crypto";

type TrainingUser = Pick<AuthenticatedUser, "id" | "company_id" | "role" | "full_name" | "employee_id">;

const PASS_MARK = 70;

function certNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6) as Buffer;
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[bytes[i] % chars.length];
  return `CERT-${s}`;
}

function serializeAssignment(a: Record<string, unknown>) {
  return serializeDoc(a);
}

export async function listTraining(user: TrainingUser, scope?: string) {
  const conn = await connectDB();
  if (!conn) return null;

  const courses = await TrainingCourse.find({ company_id: user.company_id }).sort({ created_at: -1 }).lean();

  if (user.role === "admin" || user.role === "hr") {
    const courseIds = courses.map((c) => c._id);
    const assignments = await TrainingAssignment.find({
      company_id: user.company_id,
      course_id: { $in: courseIds },
    }).lean();
    const employees = await Employee.find({ company_id: user.company_id }).select("_id full_name").lean();
    const empMap = new Map(employees.map((e) => [e._id.toString(), e.full_name]));
    const byCourse = new Map<string, typeof assignments>();
    for (const a of assignments) {
      const k = a.course_id.toString();
      if (!byCourse.has(k)) byCourse.set(k, []);
      byCourse.get(k)!.push(a);
    }
    const rows = courses.map((c) => {
      const list = byCourse.get(c._id.toString()) || [];
      const completed = list.filter((a) => a.status === "completed").length;
      return {
        ...serializeDoc(c as unknown as Record<string, unknown>),
        assigned_count: list.length,
        completed_count: completed,
        avg_progress: list.length ? Math.round(list.reduce((s, a) => s + a.progress, 0) / list.length) : 0,
        assignments: list.map((a) => ({
          ...serializeAssignment(a as unknown as Record<string, unknown>),
          employee_name: empMap.get(a.employee_id.toString()) || "Unknown",
        })),
      };
    });
    return { courses: rows };
  }

  if (user.role === "manager" && scope === "team") {
    // Managers monitor progress of their direct reports.
    const employees = await Employee.find({
      company_id: user.company_id,
      manager: user.full_name,
    }).select("_id full_name").lean();
    const ids = employees.map((e) => e._id);
    if (!ids.length) return { courses: [] };
    const assignments = await TrainingAssignment.find({
      company_id: user.company_id,
      employee_id: { $in: ids },
    }).lean();
    const empMap = new Map(employees.map((e) => [e._id.toString(), e.full_name]));
    const courseMap = new Map(courses.map((c) => [c._id.toString(), c.title]));
    const rows = assignments.map((a) => ({
      ...serializeAssignment(a as unknown as Record<string, unknown>),
      employee_name: empMap.get(a.employee_id.toString()) || "Unknown",
      course_title: courseMap.get(a.course_id.toString()) || "Unknown course",
    }));
    return { courses: rows };
  }

  // Employees: courses assigned to them.
  if (!user.employee_id) return { courses: [] };
  const assignments = await TrainingAssignment.find({
    company_id: user.company_id,
    employee_id: user.employee_id,
  }).lean();
  const courseMap = new Map(courses.map((c) => [c._id.toString(), c]));
  const rows = assignments.map((a) => {
    const course = courseMap.get(a.course_id.toString());
    return {
      ...serializeAssignment(a as unknown as Record<string, unknown>),
      course: course
        ? serializeDoc({ ...course, materials: (course.materials || []).length })
        : null,
      materials: course?.materials || [],
    };
  });
  return { courses: rows };
}

export async function createCourse(
  user: TrainingUser,
  input: {
    title: string;
    description?: string;
    category?: string;
    is_mandatory?: boolean;
    materials: { title: string; type: string; url?: string; content?: string; duration_min?: number; questions?: { question: string; options: string[]; answer_index: number }[] }[];
  }
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  if (user.role !== "admin" && user.role !== "hr") throw new Error("Insufficient permissions");

  const materials = (input.materials || []).map((m) => ({
    title: m.title,
    type: m.type,
    url: m.url || "",
    content: m.content || "",
    duration_min: m.duration_min || 0,
    questions: (m.questions || []).map((q) => ({
      question: q.question,
      options: q.options || [],
      answer_index: Math.max(0, Number(q.answer_index) || 0),
    })),
  }));

  const doc = await TrainingCourse.create({
    company_id: user.company_id,
    title: input.title,
    description: input.description || "",
    category: input.category || "other",
    is_mandatory: !!input.is_mandatory,
    created_by: user.id,
    created_by_name: user.full_name,
    materials,
    published: true,
  });
  return { course: serializeDoc(doc.toObject()) };
}

export async function updateCourse(
  user: TrainingUser,
  input: { id: string; title?: string; description?: string; category?: string; is_mandatory?: boolean; materials?: unknown[] }
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  if (user.role !== "admin" && user.role !== "hr") throw new Error("Insufficient permissions");

  const doc = await TrainingCourse.findOne({ _id: input.id, company_id: user.company_id });
  if (!doc) return { error: "Course not found" };

  if (input.title !== undefined) doc.title = input.title;
  if (input.description !== undefined) doc.description = input.description;
  if (input.category !== undefined) doc.category = input.category as never;
  if (input.is_mandatory !== undefined) doc.is_mandatory = input.is_mandatory;
  if (input.materials !== undefined) {
    doc.materials = (input.materials as {
      title: string;
      type: string;
      url?: string;
      content?: string;
      duration_min?: number;
      questions?: { question: string; options: string[]; answer_index: number }[];
    }[]).map((m) => ({
      title: m.title,
      type: m.type,
      url: m.url || "",
      content: m.content || "",
      duration_min: m.duration_min || 0,
      questions: (m.questions || []).map((q) => ({
        question: q.question,
        options: q.options || [],
        answer_index: Math.max(0, Number(q.answer_index) || 0),
      })),
    }));
  }
  await doc.save();
  return { course: serializeDoc(doc.toObject()) };
}

export async function deleteCourse(user: TrainingUser, id: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  if (user.role !== "admin" && user.role !== "hr") throw new Error("Insufficient permissions");

  const doc = await TrainingCourse.findOne({ _id: id, company_id: user.company_id });
  if (!doc) return { error: "Course not found" };
  await TrainingAssignment.deleteMany({ company_id: user.company_id, course_id: doc._id });
  await TrainingCourse.deleteOne({ _id: doc._id });
  return { ok: true };
}

export async function assignCourse(user: TrainingUser, courseId: string, employeeIds: string[]) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const course = await TrainingCourse.findOne({ _id: courseId, company_id: user.company_id }).lean();
  if (!course) return { error: "Course not found" };

  const validIds = (employeeIds || []).filter((id) => Types.ObjectId.isValid(id));
  if (!validIds.length) return { error: "No valid employees selected" };

  if (user.role === "manager") {
    const employees = await Employee.find({
      _id: { $in: validIds.map((id) => new Types.ObjectId(id)) },
      company_id: user.company_id,
      manager: user.full_name,
    }).select("_id").lean();
    const allowed = new Set(employees.map((e) => e._id.toString()));
    const filtered = validIds.filter((id) => allowed.has(id));
    if (!filtered.length) return { error: "You can only assign training to your team" };
    employeeIds = filtered;
  }

  const existing = await TrainingAssignment.find({
    company_id: user.company_id,
    course_id: courseId,
    employee_id: { $in: validIds.map((id) => new Types.ObjectId(id)) },
  }).select("employee_id").lean();
  const existingSet = new Set(existing.map((a) => a.employee_id.toString()));

  const toCreate = employeeIds.filter((id) => !existingSet.has(id));
  if (toCreate.length) {
    await TrainingAssignment.insertMany(
      toCreate.map((id) => ({
        company_id: user.company_id,
        course_id: courseId,
        employee_id: id,
        assigned_by: user.id,
        assigned_by_name: user.full_name,
        status: "not_started",
        progress: 0,
      }))
    );
  }
  return { ok: true, assigned: toCreate.length, already: existingSet.size };
}

export async function getAssignment(user: TrainingUser, courseId: string) {
  const conn = await connectDB();
  if (!conn) return null;
  const assignment = await TrainingAssignment.findOne({
    company_id: user.company_id,
    course_id: courseId,
    employee_id: user.employee_id,
  }).lean();
  if (!assignment) return null;
  return serializeAssignment(assignment as unknown as Record<string, unknown>);
}

async function recompute(assignment: InstanceType<typeof TrainingAssignment>, course: Record<string, unknown>) {
  const materials = (course.materials || []) as { _id: Types.ObjectId; type: string }[];
  const done = ((assignment.completed_materials as Types.ObjectId[]) || []).map((v) => v.toString());
  const total = materials.length;
  const completed = materials.filter((m) => done.includes(m._id.toString())).length;
  assignment.progress = total ? Math.round((completed / total) * 100) : 100;
  if (assignment.progress >= 100) {
    assignment.status = "completed";
    if (!assignment.completed_at) assignment.completed_at = new Date();
    if (!assignment.certificate_issued_at) {
      assignment.certificate_issued_at = new Date();
      assignment.certificate_number = certNumber();
    }
  }
  await assignment.save();
}

export async function startCourse(user: TrainingUser, courseId: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const assignment = await TrainingAssignment.findOne({
    company_id: user.company_id,
    course_id: courseId,
    employee_id: user.employee_id,
  });
  if (!assignment) return { error: "Course is not assigned to you" };
  if (assignment.status === "completed") return { assignment: serializeAssignment(assignment.toObject()) };

  assignment.status = "in_progress";
  if (!assignment.started_at) assignment.started_at = new Date();
  await assignment.save();
  return { assignment: serializeAssignment(assignment.toObject()) };
}

export async function completeMaterial(user: TrainingUser, courseId: string, materialId: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const assignment = await TrainingAssignment.findOne({
    company_id: user.company_id,
    course_id: courseId,
    employee_id: user.employee_id,
  });
  if (!assignment) return { error: "Course is not assigned to you" };

  const course = await TrainingCourse.findOne({ _id: courseId, company_id: user.company_id }).lean();
  if (!course) return { error: "Course not found" };

  const materials = (course.materials as unknown[]) || [];
  const material = materials.find((m) => (m as { _id: Types.ObjectId })._id.toString() === materialId);
  if (!material) return { error: "Material not found" };
  if ((material as { type: string }).type === "quiz") {
    // Quizzes must be completed by passing the quiz.
    const existing = ((assignment.quiz_scores as { material_id: Types.ObjectId; passed: boolean }[]) || []).find((s) => s.material_id.toString() === materialId);
    if (!existing || !existing.passed) return { error: "You must pass the quiz first" };
  }

  if (!((assignment.completed_materials as Types.ObjectId[]) || []).some((v) => v.toString() === materialId)) {
    assignment.completed_materials = [...(assignment.completed_materials as Types.ObjectId[] || []), new Types.ObjectId(materialId)];
  }
  const wasCompleted = assignment.status === "completed";
  await recompute(assignment, course);
  if (assignment.status === "completed" && !wasCompleted) {
    await rewardCourseComplete(user);
  }
  return { assignment: serializeAssignment(assignment.toObject()) };
}

export async function submitQuiz(
  user: TrainingUser,
  courseId: string,
  materialId: string,
  answers: number[]
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const assignment = await TrainingAssignment.findOne({
    company_id: user.company_id,
    course_id: courseId,
    employee_id: user.employee_id,
  });
  if (!assignment) return { error: "Course is not assigned to you" };

  const course = await TrainingCourse.findOne({ _id: courseId, company_id: user.company_id }).lean();
  if (!course) return { error: "Course not found" };

  const materials = (course.materials as unknown[]) || [];
  const material = materials.find((m) => (m as { _id: Types.ObjectId })._id.toString() === materialId);
  if (!material || (material as { type: string }).type !== "quiz") return { error: "Quiz material not found" };

  const questions = ((material as { questions: { answer_index: number }[] }).questions) || [];
  if (!questions.length) return { error: "Quiz has no questions" };

  const correct = questions.filter((q, i) => Number(answers?.[i]) === Number(q.answer_index)).length;
  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= PASS_MARK;
  const existingScores = (assignment.quiz_scores as { material_id: Types.ObjectId; score: number; passed: boolean }[]) || [];
  const hadPassedBefore = existingScores.some((s) => s.material_id.toString() === materialId && s.passed);
  const filtered = existingScores.filter((s) => s.material_id.toString() !== materialId);
  filtered.push({ material_id: new Types.ObjectId(materialId), score, passed });
  assignment.quiz_scores = filtered as never[];

  const best = Math.max(...filtered.map((s) => s.score), 0);
  assignment.score = best;

  if (passed) {
    if (!((assignment.completed_materials as Types.ObjectId[]) || []).some((v) => v.toString() === materialId)) {
      assignment.completed_materials = [...(assignment.completed_materials as Types.ObjectId[] || []), new Types.ObjectId(materialId)];
    }
  }
  const wasCompleted = assignment.status === "completed";
  await recompute(assignment, course);

  if (passed) {
    if (!hadPassedBefore) {
      await rewardQuizPass(user);
    }
    if (assignment.status === "completed" && !wasCompleted) {
      await rewardCourseComplete(user);
    }
  }

  return {
    assignment: serializeAssignment(assignment.toObject()),
    score,
    passed,
    correct,
    total: questions.length,
    justCompleted: assignment.status === "completed" && !wasCompleted,
  };
}