"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/lib/use-user";
import { GraduationCap, Book, FileText, Link2, ListChecks, Trash2, Award, X } from "lucide-react";

interface QuizQuestion {
  question: string;
  options: string[];
  answer_index: number;
}

interface Material {
  _id?: string;
  id?: string;
  title: string;
  type: string;
  url?: string;
  content?: string;
  duration_min?: number;
  questions?: QuizQuestion[];
}

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  is_mandatory: boolean;
  created_by_name: string;
  materials: Material[];
  assigned_count?: number;
  completed_count?: number;
  avg_progress?: number;
  assignments?: {
    id: string;
    status: string;
    progress: number;
    score: number;
    certificate_issued_at?: string;
    certificate_number?: string;
    employee_name?: string;
    course_title?: string;
  }[];
  status?: string;
  progress?: number;
  score?: number;
  certificate_issued_at?: string;
  certificate_number?: string;
  employee_name?: string;
  completed_materials?: string[];
  course?: { id: string; title: string; category: string; is_mandatory: boolean; materials?: number } | null;
}

const CATEGORY_META: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  compliance: { label: "Compliance", variant: "danger" },
  onboarding: { label: "Onboarding", variant: "info" },
  skills: { label: "Skills", variant: "success" },
  safety: { label: "Safety", variant: "warning" },
  product: { label: "Product", variant: "default" },
  other: { label: "Other", variant: "default" },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  video: <FileText className="h-4 w-4" />,
  document: <FileText className="h-4 w-4" />,
  link: <Link2 className="h-4 w-4" />,
  quiz: <ListChecks className="h-4 w-4" />,
};

const emptyQuestion = (): QuizQuestion => ({ question: "", options: ["", "", "", ""], answer_index: 0 });
const emptyMaterial = (): Material => ({ title: "", type: "document", url: "", questions: [emptyQuestion()] });

export default function TrainingPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [showCert, setShowCert] = useState<Course | null>(null);
  const [assignIds, setAssignIds] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({ title: "", description: "", category: "other", is_mandatory: false, materials: [emptyMaterial()] });
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number[]>>({});

  const role = user?.role || "employee";
  const isStaff = role === "admin" || role === "hr";
  const isManager = role === "manager";

  const load = useCallback(async () => {
    const scope = isManager && !isStaff ? "team" : undefined;
    const url = scope ? "/api/training?scope=team" : "/api/training";
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setCourses(data.courses || []);
    } finally {
      setLoading(false);
    }
  }, [isManager, isStaff]);

  useEffect(() => {
    load();
  }, [load]);

useEffect(() => {
    if (!isStaff && !isManager) return;
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [isStaff, isManager]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addMaterial = () => setForm({ ...form, materials: [...form.materials, emptyMaterial()] });
  const updateMaterial = (i: number, patch: Partial<Material>) => {
    const materials = [...form.materials];
    materials[i] = { ...materials[i], ...patch };
    setForm({ ...form, materials });
  };
  const removeMaterial = (i: number) => {
    const materials = form.materials.filter((_, idx) => idx !== i);
    setForm({ ...form, materials });
  };
  const updateQuestion = (mi: number, qi: number, patch: Partial<QuizQuestion>) => {
    const materials = [...form.materials];
    const questions = materials[mi].questions || [];
    questions[qi] = { ...questions[qi], ...patch };
    materials[mi] = { ...materials[mi], questions };
    setForm({ ...form, materials });
  };
  const addQuestion = (mi: number) => {
    const materials = [...form.materials];
    materials[mi] = { ...materials[mi], questions: [...(materials[mi].questions || []), emptyQuestion()] };
    setForm({ ...form, materials });
  };
  const removeQuestion = (mi: number, qi: number) => {
    const materials = [...form.materials];
    materials[mi] = { ...materials[mi], questions: (materials[mi].questions || []).filter((_, idx) => idx !== qi) };
    setForm({ ...form, materials });
  };
  const setOption = (mi: number, qi: number, oi: number, value: string) => {
    const materials = [...form.materials];
    const q = materials[mi].questions![qi];
    q.options[oi] = value;
    setForm({ ...form, materials });
  };

  const createCourse = async () => {
    if (!form.title.trim()) {
      setMessage("Course title is required");
      return;
    }
    const materials = form.materials.filter((m) => m.title.trim());
    if (!materials.length) {
      setMessage("Add at least one material");
      return;
    }
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, materials }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Unable to create course");
      return;
    }
    setForm({ title: "", description: "", category: "other", is_mandatory: false, materials: [emptyMaterial()] });
    setShowForm(false);
    load();
  };

  const doAssign = async () => {
    if (!assigningCourseId || assignIds.size === 0) {
      setMessage("Select a course and at least one employee");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/training", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", course_id: assigningCourseId, employee_ids: [...assignIds] }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Unable to assign");
      return;
    }
    setAssigningCourseId("");
    setAssignIds(new Set());
    setShowAssign(false);
    load();
  };

  const progress = async (course: Course, action: string, materialId?: string, answers?: number[]) => {
    setBusy(true);
    const res = await fetch("/api/training/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: course.id, action, material_id: materialId, answers }),
    });
    setBusy(false);
    if (!res.ok) return;
    setQuizAnswers((prev) => ({ ...prev, [materialId || course.id]: [] }));
    const data = await res.json();
    if (data.justCompleted) setShowCert({ ...course, title: course.title });
    load();
  };

  const remove = async (id: string) => {
    setBusy(true);
    await fetch(`/api/training?id=${id}`, { method: "DELETE" });
    setBusy(false);
    load();
  };

  const [showAssign, setShowAssign] = useState(false);
  const [assigningCourseId, setAssigningCourseId] = useState("");

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isStaff ? "Create courses and monitor completion" : isManager ? "Monitor your team's training" : "Complete your assigned courses"}
          </p>
        </div>
        {isStaff && (
          <Button onClick={() => setShowForm(!showForm)}>
            <GraduationCap className="mr-2 h-4 w-4" />New Course
          </Button>
        )}
      </div>

      {message && <p className="mb-4 text-sm text-red-600">{message}</p>}

      {showForm && isStaff && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Create Course</CardTitle>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. New Hire Orientation" />
              <div className="flex gap-4">
                <div className="flex-1">
                  <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    options={Object.entries(CATEGORY_META).map(([k, v]) => ({ value: k, label: v.label }))} />
                </div>
                <label className="mt-7 flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.is_mandatory} onChange={(e) => setForm({ ...form, is_mandatory: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                  Mandatory
                </label>
              </div>
            </div>
            <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What will employees learn?" />

            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Materials</p>
              {form.materials.map((m, mi) => (
                <div key={mi} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-36">
                      <Select value={m.type} onChange={(e) => { const type = e.target.value; updateMaterial(mi, { type, questions: type === "quiz" ? m.questions?.length ? m.questions : [emptyQuestion()] : [] }); }}
                        options={[{ value: "video", label: "Video" }, { value: "document", label: "Document" }, { value: "link", label: "Link" }, { value: "quiz", label: "Quiz" }]} />
                    </div>
                    <div className="flex-1 min-w-[220px]">
                      <Input value={m.title} onChange={(e) => updateMaterial(mi, { title: e.target.value })} placeholder="Material title" />
                    </div>
                    {m.type !== "quiz" && (
                      <div className="flex-1 min-w-[220px]">
                        <Input value={m.url || ""} onChange={(e) => updateMaterial(mi, { url: e.target.value })} placeholder={m.type === "video" ? "Video URL" : m.type === "link" ? "Link URL" : "Document text or URL"} />
                      </div>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => removeMaterial(mi)}><Trash2 className="h-4 w-4" /></Button>
                  </div>

                  {m.type === "quiz" && (
                    <div className="mt-3 space-y-3">
                      {(m.questions || []).map((q, qi) => (
                        <div key={qi} className="rounded-lg bg-gray-50 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-gray-500">Question {qi + 1}</p>
                            <Button size="sm" variant="ghost" onClick={() => removeQuestion(mi, qi)}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                          <Input value={q.question} onChange={(e) => updateQuestion(mi, qi, { question: e.target.value })} placeholder="Question text" className="mt-2" />
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {q.options.map((opt, oi) => (
                              <label key={oi} className="flex items-center gap-2">
                                <input type="radio" className="h-4 w-4 text-indigo-600" checked={q.answer_index === oi} onChange={() => updateQuestion(mi, qi, { answer_index: oi })} />
                                <input value={opt} onChange={(e) => setOption(mi, qi, oi, e.target.value)} placeholder={`Option ${oi + 1}`} className="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none" />
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" onClick={() => addQuestion(mi)}>+ Add Question</Button>
                    </div>
                  )}
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addMaterial}>+ Add Material</Button>
            </div>

            <Button loading={busy} onClick={createCourse}>Create Course</Button>
          </CardContent>
        </Card>
      )}

      {(isStaff || isManager) && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[240px] flex-1">
                <Select label="Assign course to" value={assigningCourseId} onChange={(e) => setAssigningCourseId(e.target.value)}
                  options={[{ value: "", label: "Select a course" }, ...courses.map((c) => ({ value: c.id, label: c.title }))]} />
              </div>
              <div>
                <Button variant="outline" onClick={() => setShowAssign(!showAssign)} disabled={!assigningCourseId}>
                  Pick employees
                </Button>
              </div>
            </div>
            {showAssign && (
              <div className="mt-4">
                <p className="mb-2 text-xs text-gray-500">Select employees to assign</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {employees.map((emp) => (
                    <label key={emp.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
                      <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                        checked={assignIds.has(emp.id)}
                        onChange={(e) => {
                          const next = new Set(assignIds);
                          if (e.target.checked) next.add(emp.id);
                          else next.delete(emp.id);
                          setAssignIds(next);
                        }} />
                      {emp.full_name}
                    </label>
                  ))}
                </div>
                <Button className="mt-3" size="sm" loading={busy} onClick={doAssign}>Assign {assignIds.size > 0 ? `(${assignIds.size})` : ""}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {courses.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon={<GraduationCap className="h-12 w-12" />} title="No courses" description="Courses assigned to you will appear here." />
          </CardContent></Card>
        ) : (
          courses.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-indigo-500" />
                    <h3 className="font-semibold text-gray-900">{c.title}</h3>
                    <Badge variant={CATEGORY_META[c.category]?.variant || "default"}>{CATEGORY_META[c.category]?.label || c.category}</Badge>
                    {c.is_mandatory && <Badge variant="danger">Mandatory</Badge>}
                    {c.status === "completed" && <Badge variant="success">Completed</Badge>}
                  </div>
                  {isStaff && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" loading={busy} onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">by {c.created_by_name || "HR"}</p>
                {c.description && <p className="mt-2 text-sm text-gray-600">{c.description}</p>}

                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  {c.status !== undefined ? (
                    <>
                      <span className="text-gray-600">Progress: <strong>{c.progress}%</strong></span>
                      {c.score !== undefined && c.score > 0 && <span className="text-gray-500">Best quiz score: {c.score}%</span>}
                      {c.certificate_issued_at && (
                        <Button size="sm" variant="outline" onClick={() => setShowCert(c)}>
                          <Award className="mr-1.5 h-4 w-4" />Certificate
                        </Button>
                      )}
                    </>
                  ) : isStaff ? (
                    <>
                      <span className="text-gray-600">{c.assigned_count} assigned · {c.completed_count} completed</span>
                      <span className="text-gray-500">Avg progress {c.avg_progress}%</span>
                    </>
                  ) : (
                    <span className="text-gray-600">{c.employee_name} · {c.status === "completed" ? "Completed" : `${c.progress}%`}</span>
                  )}
                  {isManager && c.employee_name && <span className="text-gray-400">{c.employee_name}</span>}
                </div>

                {isStaff && c.assignments && c.assignments.length > 0 && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
                    {c.assignments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-1">
                        <span className="text-gray-700">{a.employee_name}</span>
                        <span className="text-gray-500">{a.status === "completed" ? "✔ Completed" : `${a.progress}%`} {a.score ? `· score ${a.score}%` : ""}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Button size="sm" variant="ghost" className="mt-3" onClick={() => toggle(c.id)}>
                  {expanded.has(c.id) ? "Hide materials" : "View materials"}
                </Button>

                {expanded.has(c.id) && (
                  <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-4">
                    {(c.materials || []).map((m: Material, mi: number) => {
                      const mid = m._id || m.id || "";
                      const done = c.completed_materials ? (c.completed_materials as string[]).includes(mid) : false;
                      return (
                        <div key={mi} className="rounded-lg bg-white p-3 shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {TYPE_ICON[m.type] || <Book className="h-4 w-4" />}
                              <span className="text-sm font-medium text-gray-800">{m.title}</span>
                              {done && <Badge variant="success">Done</Badge>}
                            </div>
                            {m.type !== "quiz" && !done && (
                              <div className="flex gap-2">
                                {m.url && <Button size="sm" variant="outline" onClick={() => window.open(m.url, "_blank")}>Open</Button>}
                                <Button size="sm" loading={busy} onClick={() => progress(c, "complete", mid)}>Mark Complete</Button>
                              </div>
                            )}
                          </div>
                          {m.type === "quiz" && !done && (
                            <div className="mt-3 space-y-3">
                              {(m.questions || []).map((q: QuizQuestion, qi: number) => (
                                <div key={qi}>
                                  <p className="text-sm font-medium text-gray-800">{qi + 1}. {q.question}</p>
                                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                    {q.options.map((opt, oi) => (
                                      <label key={oi} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">
                                        <input type="radio" className="h-4 w-4 text-indigo-600"
                                          name={`${mid}-${qi}`}
                                          checked={quizAnswers[mid]?.[qi] === oi}
                                          onChange={() => {
                                            const next = [...(quizAnswers[mid] || [])];
                                            next[qi] = oi;
                                            setQuizAnswers({ ...quizAnswers, [mid]: next });
                                          }} />
                                        {opt}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              <Button size="sm" loading={busy} onClick={() => progress(c, "quiz", mid, quizAnswers[mid] || [])} disabled={!((quizAnswers[mid] || []).length === (m.questions || []).length)}>
                                Submit Quiz
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {showCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCert(null)}>
          <div className="w-full max-w-md rounded-2xl border-4 border-indigo-200 bg-white p-8 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <Award className="mx-auto h-14 w-14 text-indigo-500" />
            <h2 className="mt-3 text-xl font-bold text-gray-900">Certificate of Completion</h2>
            <p className="mt-1 text-sm text-gray-500">This certifies that</p>
            <p className="mt-2 text-lg font-semibold text-gray-900">{user?.name}</p>
            <p className="mt-1 text-sm text-gray-500">has completed the course</p>
            <p className="mt-1 font-semibold text-indigo-700">{showCert.title}</p>
            {showCert.certificate_number && <p className="mt-3 text-xs text-gray-400">ID: {showCert.certificate_number}</p>}
            <Button className="mt-5 w-full" variant="outline" onClick={() => setShowCert(null)}>Close</Button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}