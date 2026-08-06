import { Schema, model, models, Types } from "mongoose";

export const UserRole = ["admin", "hr", "manager", "employee"] as const;
export const RiskLevel = ["green", "yellow", "red"] as const;
export const TaskCategory = ["day1", "first_week", "first_month", "custom"] as const;
export const RequestCategory = ["IT", "HR", "Access", "Equipment", "Documentation", "Other"] as const;
export const RequestStatus = ["Open", "In Progress", "Resolved"] as const;
export const RequestPriority = ["Low", "Medium", "High", "Urgent"] as const;
export const LeaveType = ["annual", "sick", "casual", "unpaid", "other"] as const;
export const LeaveStatus = ["pending", "hr_pending", "approved", "rejected", "cancelled"] as const;
export const AnnouncementCategory = ["general", "important", "event", "training"] as const;
export const TrainingCategory = ["compliance", "onboarding", "skills", "safety", "product", "other"] as const;
export const TrainingMaterialType = ["video", "document", "link", "quiz"] as const;
export const TrainingStatus = ["not_started", "in_progress", "completed"] as const;
export const AssetType = ["laptop", "monitor", "phone", "peripheral", "software", "other"] as const;
export const AssetStatus = ["available", "assigned", "maintenance", "retired"] as const;
export const VaultCategory = ["policy", "contract", "onboarding", "legal", "hr", "training", "other"] as const;
export const CalendarEventType = ["holiday", "event", "birthday", "anniversary", "other"] as const;

function ref(name: string, required = false) {
  return { type: Types.ObjectId, ref: name, required };
}

// ─── Company ────────────────────────────────────────────────────────
const CompanySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    logo_url: { type: String, default: "" },
    access_code: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    office_info: {
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      country: { type: String, default: "" },
      timezone: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    settings: {
      allow_employee_registration: { type: Boolean, default: false },
      onboarding_auto_assign: { type: Boolean, default: true },
      welcome_tour_required: { type: Boolean, default: true },
      work_start_time: { type: String, default: "09:30" },
      work_end_time: { type: String, default: "18:00" },
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
CompanySchema.index({ access_code: 1 });

// ─── Users (replaces Supabase Auth users + profiles) ────────────────
const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    full_name: { type: String, required: true, trim: true },
    role: { type: String, enum: UserRole, default: "employee" },
    company_id: ref("Company", true),
    avatar_url: { type: String, default: "" },
    reset_token: { type: String, default: null },
    reset_token_expires: { type: Date, default: null },
    must_change_password: { type: Boolean, default: false },
    last_login_at: { type: Date, default: null },
    phone: { type: String, default: "" },
    language: { type: String, default: "en" },
    timezone: { type: String, default: "" },
    profile_completed: { type: Boolean, default: false },
    has_accepted_policies_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);

// ─── Department ─────────────────────────────────────────────────────
const DepartmentSchema = new Schema(
  {
    company_id: ref("Company", true),
    name: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);

// ─── Employee ───────────────────────────────────────────────────────
const EmployeeSchema = new Schema(
  {
    company_id: ref("Company", true),
    user_id: ref("User"),
    department_id: ref("Department"),
    full_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    job_title: { type: String, default: "" },
    manager: { type: String, default: "" },
    joining_date: { type: Date, required: true },
    progress: { type: Number, default: 0 },
    risk_level: { type: String, enum: RiskLevel, default: "green" },
    points: { type: Number, default: 0 },
    badges: {
      type: [
        new Schema(
          {
            code: { type: String, required: true },
            awarded_at: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    current_streak: { type: Number, default: 0 },
    best_streak: { type: Number, default: 0 },
    last_attendance_date: { type: Date },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
EmployeeSchema.index({ company_id: 1, email: 1 }, { unique: true });

// ─── Onboarding Template + embedded tasks ───────────────────────────
const OnboardingTaskSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, enum: TaskCategory, default: "first_week" },
    mandatory: { type: Boolean, default: false },
    day_offset: { type: Number, default: 0 },
    sort_order: { type: Number, default: 0 },
  },
  { _id: true }
);

const OnboardingTemplateSchema = new Schema(
  {
    company_id: ref("Company", true),
    name: { type: String, required: true },
    scope: { type: String, enum: ["company", "department", "role"], default: "company" },
    department_id: ref("Department"),
    role_pattern: { type: String, default: "" },
    tasks: { type: [OnboardingTaskSchema], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);

// ─── Employee Task (assigned instance) ──────────────────────────────
const EmployeeTaskSchema = new Schema(
  {
    employee_id: ref("Employee", true),
    company_id: ref("Company", true),
    template_task_id: ref("OnboardingTemplate"),
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, enum: TaskCategory, default: "day1" },
    mandatory: { type: Boolean, default: true },
    completed: { type: Boolean, default: false },
    completed_at: { type: Date, default: null },
    due_date: { type: Date },
    sort_order: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
EmployeeTaskSchema.index({ employee_id: 1, sort_order: 1 });

// ─── Support Requests ───────────────────────────────────────────────
const SupportRequestSchema = new Schema(
  {
    company_id: ref("Company", true),
    employee_id: ref("Employee"),
    employee_name: { type: String, default: "" },
    department: { type: String, default: "" },
    category: { type: String, enum: RequestCategory, default: "Other" },
    type: { type: String, required: true },
    description: { type: String, default: "" },
    priority: { type: String, enum: RequestPriority, default: "Medium" },
    status: { type: String, enum: RequestStatus, default: "Open" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
SupportRequestSchema.index({ company_id: 1, created_at: -1 });

// ─── Notifications ──────────────────────────────────────────────────
const NotificationSchema = new Schema(
  {
    company_id: ref("Company", true),
    user_id: ref("User", true),
    title: { type: String, required: true },
    body: { type: String, default: "" },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);

// ─── Policies ───────────────────────────────────────────────────────
const PolicySchema = new Schema(
  {
    company_id: ref("Company", true),
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String, default: "Other" },
    version: { type: Number, default: 1 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
PolicySchema.index({ company_id: 1, title: 1 });

// ─── Policy Documents (uploaded files) ──────────────────────────────
const PolicyDocumentSchema = new Schema(
  {
    company_id: ref("Company", true),
    uploaded_by: ref("User", true),
    title: { type: String, required: true },
    file_url: { type: String, default: "" },
    file_type: { type: String, default: "" },
    file_size: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);

// ─── Policy Chunks (for RAG / vector search) ────────────────────────
const PolicyChunkSchema = new Schema(
  {
    company_id: ref("Company", true),
    policy_id: ref("Policy"),
    document_id: ref("PolicyDocument"),
    content: { type: String, required: true },
    embedding: { type: [Number], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
PolicyChunkSchema.index({ company_id: 1 });

// ─── Activity Logs ──────────────────────────────────────────────────
const ActivityLogSchema = new Schema(
  {
    company_id: ref("Company", true),
    employee_id: ref("Employee"),
    action: { type: String, required: true },
    details: { type: String, default: "" },
    ip: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
ActivityLogSchema.index({ company_id: 1, created_at: -1 });

// ─── Sessions (refresh tokens) ──────────────────────────────────────
const SessionSchema = new Schema(
  {
    user_id: ref("User", true),
    refresh_token_hash: { type: String, required: true },
    expires_at: { type: Date, required: true },
    user_agent: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
SessionSchema.index({ user_id: 1 });
SessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// ─── Invitations ────────────────────────────────────────────────────
const InvitationSchema = new Schema(
  {
    company_id: ref("Company", true),
    email: { type: String, required: true, lowercase: true, trim: true },
    user_id: ref("User"),
    invited_by: ref("User", true),
    status: { type: String, enum: ["pending", "accepted", "completed"], default: "pending" },
    access_code: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
InvitationSchema.index({ company_id: 1, email: 1 });

// ─── Attendance ─────────────────────────────────────────────────────
const BreakEntrySchema = new Schema(
  {
    start: { type: Date },
    end: { type: Date },
  },
  { _id: true }
);

const AttendanceRecordSchema = new Schema(
  {
    company_id: ref("Company", true),
    employee_id: ref("Employee", true),
    user_id: ref("User", true),
    date: { type: Date, required: true },
    check_in: { type: Date },
    check_out: { type: Date },
    breaks: { type: [BreakEntrySchema], default: [] },
    work_seconds: { type: Number, default: 0 },
    break_seconds: { type: Number, default: 0 },
    is_late: { type: Boolean, default: false },
    late_minutes: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
AttendanceRecordSchema.index({ company_id: 1, employee_id: 1, date: 1 }, { unique: true });
AttendanceRecordSchema.index({ company_id: 1, date: 1 });

// ─── Leave ──────────────────────────────────────────────────────────
const LeaveRequestSchema = new Schema(
  {
    company_id: ref("Company", true),
    employee_id: ref("Employee", true),
    user_id: ref("User", true),
    leave_type: { type: String, enum: LeaveType, default: "annual" },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    days: { type: Number, required: true },
    reason: { type: String, default: "" },
    status: { type: String, enum: LeaveStatus, default: "pending" },
    decided_by: ref("User"),
    decided_at: { type: Date },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
LeaveRequestSchema.index({ company_id: 1, status: 1 });
LeaveRequestSchema.index({ employee_id: 1, created_at: -1 });

const LeaveBalanceSchema = new Schema(
  {
    company_id: ref("Company", true),
    employee_id: ref("Employee", true),
    annual_total: { type: Number, default: 20 },
    annual_used: { type: Number, default: 0 },
    sick_total: { type: Number, default: 10 },
    sick_used: { type: Number, default: 0 },
    casual_total: { type: Number, default: 5 },
    casual_used: { type: Number, default: 0 },
    unpaid_total: { type: Number, default: 0 },
    unpaid_used: { type: Number, default: 0 },
    other_total: { type: Number, default: 0 },
    other_used: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
LeaveBalanceSchema.index({ company_id: 1, employee_id: 1 }, { unique: true });

// ─── Announcements ──────────────────────────────────────────────────
const AnnouncementCommentSchema = new Schema(
  {
    user_id: ref("User"),
    full_name: { type: String, default: "" },
    content: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const AnnouncementSchema = new Schema(
  {
    company_id: ref("Company", true),
    author_id: ref("User", true),
    author_name: { type: String, default: "" },
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String, enum: AnnouncementCategory, default: "general" },
    pinned: { type: Boolean, default: false },
    likes: { type: [Types.ObjectId], default: [] },
    bookmarks: { type: [Types.ObjectId], default: [] },
    comments: { type: [AnnouncementCommentSchema], default: [] },
    published_at: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
AnnouncementSchema.index({ company_id: 1, pinned: -1, published_at: -1 });

// ─── Training / LMS ────────────────────────────────────────────────
const QuizQuestionSchema = new Schema(
  {
    question: { type: String, required: true },
    options: { type: [String], default: [] },
    answer_index: { type: Number, default: 0 },
  },
  { _id: true }
);

const TrainingMaterialSchema = new Schema(
  {
    title: { type: String, required: true },
    type: { type: String, enum: TrainingMaterialType, default: "document" },
    url: { type: String, default: "" },
    content: { type: String, default: "" },
    duration_min: { type: Number, default: 0 },
    questions: { type: [QuizQuestionSchema], default: [] },
  },
  { _id: true }
);

const TrainingCourseSchema = new Schema(
  {
    company_id: ref("Company", true),
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, enum: TrainingCategory, default: "other" },
    is_mandatory: { type: Boolean, default: false },
    created_by: ref("User"),
    created_by_name: { type: String, default: "" },
    materials: { type: [TrainingMaterialSchema], default: [] },
    published: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
TrainingCourseSchema.index({ company_id: 1, created_at: -1 });

const QuizScoreSchema = new Schema(
  {
    material_id: Types.ObjectId,
    score: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
  },
  { _id: false }
);

const TrainingAssignmentSchema = new Schema(
  {
    company_id: ref("Company", true),
    course_id: ref("TrainingCourse", true),
    employee_id: ref("Employee", true),
    assigned_by: ref("User"),
    assigned_by_name: { type: String, default: "" },
    status: { type: String, enum: TrainingStatus, default: "not_started" },
    progress: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    completed_materials: { type: [Types.ObjectId], default: [] },
    quiz_scores: { type: [QuizScoreSchema], default: [] },
    started_at: { type: Date },
    completed_at: { type: Date },
    certificate_issued_at: { type: Date },
    certificate_number: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
TrainingAssignmentSchema.index({ company_id: 1, course_id: 1, employee_id: 1 }, { unique: true });

// ─── Assets ──────────────────────────────────────────────────────────
const AssetSchema = new Schema(
  {
    company_id: ref("Company", true),
    name: { type: String, required: true },
    type: { type: String, enum: AssetType, default: "other" },
    serial_number: { type: String, default: "" },
    status: { type: String, enum: AssetStatus, default: "available" },
    assigned_to: ref("Employee"),
    assigned_at: { type: Date },
    notes: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
AssetSchema.index({ company_id: 1, created_at: -1 });

// ─── Document Vault ─────────────────────────────────────────────────
const DocVersionSchema = new Schema(
  {
    version_number: { type: Number, required: true },
    file_name: { type: String, default: "" },
    content: { type: String, default: "" },
    file_url: { type: String, default: "" },
    file_size: { type: Number, default: 0 },
    mime_type: { type: String, default: "" },
    content_hash: { type: String, default: "" },
    uploaded_by: ref("User"),
    uploaded_by_name: { type: String, default: "" },
    notes: { type: String, default: "" },
    uploaded_at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const VaultDocumentSchema = new Schema(
  {
    company_id: ref("Company", true),
    title: { type: String, required: true },
    category: { type: String, enum: VaultCategory, default: "other" },
    description: { type: String, default: "" },
    versions: { type: [DocVersionSchema], default: [] },
    current_version: { type: Number, default: 1 },
    download_count: { type: Number, default: 0 },
    last_downloaded_at: { type: Date },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
VaultDocumentSchema.index({ company_id: 1, created_at: -1 });

// ─── Company Calendar ───────────────────────────────────────────────
const CompanyEventSchema = new Schema(
  {
    company_id: ref("Company", true),
    title: { type: String, required: true },
    type: { type: String, enum: CalendarEventType, default: "event" },
    date: { type: Date, required: true },
    all_day: { type: Boolean, default: true },
    time: { type: String, default: "" },
    location: { type: String, default: "" },
    notes: { type: String, default: "" },
    recurring: { type: Boolean, default: false },
    created_by: ref("User"),
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false }
);
CompanyEventSchema.index({ company_id: 1, date: 1 });

export const Company =
  models.Company || model("Company", CompanySchema);
export const User = models.User || model("User", UserSchema);
export const Department =
  models.Department || model("Department", DepartmentSchema);
export const Employee =
  models.Employee || model("Employee", EmployeeSchema);
export const OnboardingTemplate =
  models.OnboardingTemplate || model("OnboardingTemplate", OnboardingTemplateSchema);
export const EmployeeTask =
  models.EmployeeTask || model("EmployeeTask", EmployeeTaskSchema);
export const SupportRequest =
  models.SupportRequest || model("SupportRequest", SupportRequestSchema);
export const Notification =
  models.Notification || model("Notification", NotificationSchema);
export const Policy =
  models.Policy || model("Policy", PolicySchema);
export const PolicyDocument =
  models.PolicyDocument || model("PolicyDocument", PolicyDocumentSchema);
export const PolicyChunk =
  models.PolicyChunk || model("PolicyChunk", PolicyChunkSchema);
export const ActivityLog =
  models.ActivityLog || model("ActivityLog", ActivityLogSchema);
export const Session =
  models.Session || model("Session", SessionSchema);
export const Invitation =
  models.Invitation || model("Invitation", InvitationSchema);
export const AttendanceRecord =
  models.AttendanceRecord || model("AttendanceRecord", AttendanceRecordSchema);
export const LeaveRequest =
  models.LeaveRequest || model("LeaveRequest", LeaveRequestSchema);
export const LeaveBalance =
  models.LeaveBalance || model("LeaveBalance", LeaveBalanceSchema);
export const Announcement =
  models.Announcement || model("Announcement", AnnouncementSchema);
export const TrainingCourse =
  models.TrainingCourse || model("TrainingCourse", TrainingCourseSchema);
export const TrainingAssignment =
  models.TrainingAssignment || model("TrainingAssignment", TrainingAssignmentSchema);
export const Asset =
  models.Asset || model("Asset", AssetSchema);
export const VaultDocument =
  models.VaultDocument || model("VaultDocument", VaultDocumentSchema);
export const CompanyEvent =
  models.CompanyEvent || model("CompanyEvent", CompanyEventSchema);