import { getCompanyKnowledgeContext } from "./rag";
import { connectDB } from "@/lib/db";
import { Employee, EmployeeTask, SupportRequest, Department, Asset, TrainingCourse, VaultDocument, CompanyEvent } from "@/lib/models";
import { getEnvVars } from "@/lib/env";
import { getMyLeaves } from "./leave";
import { listAssets } from "./assets";
import { listVaultDocuments } from "./documents";
import { getAssignment, listTraining } from "./training";
import { getCalendar } from "./directory";
import { getGamification } from "./gamification";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  intent_details?: Record<string, unknown>;
  created_at: string;
}

interface RequestIntent {
  category: string;
  type: string;
  description: string;
  priority: string;
}

interface EmployeeDbInfo {
  full_name: string;
  email: string;
  job_title: string;
  department: string;
  manager: string;
  progress: number;
  risk_level: string;
  joining_date: string;
  pending_tasks: { title: string; due_date: string; category: string }[];
  overdue_tasks: { title: string; due_date: string }[];
  open_requests: { type: string; category: string; priority: string }[];
  // Leave information
  leaveBalances?: {
    annual: { total: number; used: number; available: number };
    sick: { total: number; used: number; available: number };
    casual: { total: number; used: number; available: number };
    unpaid: { total: number; used: number; available: number };
    other: { total: number; used: number; available: number };
  };
  leaveRequests?: { type: string; category: string; start_date: string; end_date: string; status: string }[];
  // Assigned assets
  assignedAssets?: { name: string; type: string; status: string; serial_number?: string }[];
  // Training information
  enrolledCourses?: { title: string; progress: number; status: string; mandatory?: boolean }[];
  // Recently accessed documents
  recentDocuments?: { title: string; file_name: string; uploaded_at: string }[];
  // Calendar events
  upcomingEvents?: { title: string; type: string; date: string; all_day: boolean; time?: string }[];
  // Streak information
  current_streak?: number;
  best_streak?: number;
  // Gamification
  gamification?: { points: number; badgesEarned: number; level?: string };
}

async function fetchEmployeeDbInfo(employeeId: string): Promise<EmployeeDbInfo | null> {
  const conn = await connectDB();
  if (!conn) return null;

  const emp = await Employee.findById(employeeId).lean();
  if (!emp) return null;

  const tasks = await EmployeeTask.find({ employee_id: employeeId }).lean();
  const requests = await SupportRequest.find({ employee_id: employeeId }).lean();

  const now = new Date().toISOString();

  let department = "";
  if (emp.department_id) {
    const dept = await Department.findById(emp.department_id).select("name").lean();
    department = dept?.name || "";
  }

  const pendingTasks = (tasks || [])
    .filter((t) => !t.completed)
    .map((t) => ({
      title: t.title,
      due_date: t.due_date ? new Date(t.due_date).toISOString() : "",
      category: t.category,
    }));

  const overdueTasks = pendingTasks.filter(
    (t) => t.due_date && t.due_date < now
  );

  const openRequests = (requests || [])
    .filter((r) => r.status !== "Resolved")
    .map((r) => ({ type: r.type, category: r.category, priority: r.priority }));

  // Fetch leave balances and requests
  let leaveBalances = undefined;
  let leaveRequests = undefined;
  try {
    const leaveUser = { id: emp._id?.toString() || "", company_id: emp.company_id?.toString() || "", employee_id: emp._id?.toString() || "", role: emp.role || "", full_name: emp.full_name || "" } as const;
    const leaveData = await getMyLeaves(leaveUser);
    if (leaveData) {
      leaveBalances = leaveData.balances;
       leaveRequests = leaveData.requests?.map((r: InstanceType<typeof SupportRequest>) => ({
          type: r.type,
          category: r.category,
          start_date: r.start_date ? new Date(r.start_date).toISOString() : "",
          end_date: r.end_date ? new Date(r.end_date).toISOString() : "",
          status: r.status
        })) || [];
    }
  } catch (e) {
    console.warn("Failed to fetch leave data:", e);
  }

  // Fetch assigned assets
  let assignedAssets = undefined;
  try {
    const assetUser = { id: emp._id?.toString() || "", company_id: emp.company_id?.toString() || "", role: emp.role || "", employee_id: emp._id?.toString() || "" } as const;
    const assetsData = await listAssets(assetUser);
    if (assetsData) {
       assignedAssets = assetsData.assets?.map((a: InstanceType<typeof Asset>) => ({
          name: a.name,
          type: a.type,
          status: a.status,
          serial_number: a.serial_number || ""
        })) || [];
    }
  } catch (e) {
    console.warn("Failed to fetch assets data:", e);
  }

  // Fetch enrolled courses
  let enrolledCourses = undefined;
  try {
    // Get all courses for the company, then filter to those assigned to this employee
    const trainingUser = { id: emp._id?.toString() || "", company_id: emp.company_id?.toString() || "", role: emp.role || "", full_name: emp.full_name || "", employee_id: emp._id?.toString() || "" } as const;
    const allCourses = await listTraining(trainingUser);
    if (allCourses) {
       enrolledCourses = await Promise.all(
         (allCourses.courses || []).map(async (course: InstanceType<typeof TrainingCourse>) => {
           const assignment = await getAssignment(trainingUser, course._id);
           if (assignment) {
             return {
               title: course.title,
               progress: assignment.progress || 0,
               status: assignment.status || "not_started",
               mandatory: course.is_mandatory || false
             };
           }
           return null;
         })
       ).then((results) => results.filter(Boolean));
    }
   } catch (e) {
     console.warn("Failed to fetch training data:", e);
   }

   // Fetch recently accessed documents (limit to 5 most recent)
   let recentDocuments = undefined;
   try {
     const docUser = { id: emp._id?.toString() || "", company_id: emp.company_id?.toString() || "", role: emp.role || "", full_name: emp.full_name || "" } as const;
     const docsData = await listVaultDocuments(docUser);
     if (docsData) {
       // Take up to 5 most recent documents
        recentDocuments = (docsData.documents || []).slice(0, 5).map((doc: InstanceType<typeof VaultDocument>) => ({
          title: doc.title,
          file_name: doc.current?.file_name || "",
          uploaded_at: doc.current?.uploaded_at || ""
        }));
     }
   } catch (e) {
     console.warn("Failed to fetch document data:", e);
   }

   // Fetch upcoming calendar events (current month)
  let upcomingEvents = undefined;
  try {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const calendarData = await getCalendar({ company_id: emp.company_id?.toString() || "", role: emp.role || "" } as const, month);
    if (calendarData) {
      upcomingEvents = (calendarData.events || []).map((e: InstanceType<typeof CompanyEvent>) => ({
        title: e.title,
        type: e.type,
        date: e.date ? new Date(e.date).toISOString() : "",
        all_day: e.all_day || false,
        time: e.time || ""
      }));
    }
  } catch (e) {
    console.warn("Failed to fetch calendar data:", e);
  }

  // Fetch gamification
  let gamification = undefined;
  try {
    const gameUser = { id: emp._id?.toString() || "", company_id: emp.company_id?.toString() || "", employee_id: emp._id?.toString() || "", full_name: emp.full_name || "" } as const;
    const gameData = await getGamification(gameUser);
    if (gameData) {
      gamification = {
        points: gameData.points || 0,
        badgesEarned: gameData.badges?.length || 0,
        level: gameData.badges.length >= 10 ? "Expert" : gameData.badges.length >= 5 ? "Advanced" : "Beginner"
      };
    }
  } catch (e) {
    console.warn("Failed to fetch gamification data:", e);
  }

   return {
     ...emp,
     department,
     pending_tasks: pendingTasks,
     overdue_tasks: overdueTasks,
     open_requests: openRequests,
     leaveBalances,
     leaveRequests,
     assignedAssets,
     enrolledCourses,
     recentDocuments,
     upcomingEvents,
     gamification
   };
}
function isEmployeeQuery(message: string): boolean {
  const lower = message.toLowerCase();
  const employeeKeywords = [
    "my manager", "my role", "my department", "my job",
    "my tasks", "my progress", "my onboarding",
    "my requests", "my support", "what do i", "what should i",
    "do i have", "am i", "who is my", "which department",
    "tasks left", "tasks due", "overdue", "my team",
    "my profile", "my information",
    "leave balance", "leave available", "casual leave", "casual leaves",
    "annual leave", "annual leaves", "sick leave", "sick leaves",
    "how many leave", "vacation balance", "pto balance",
    "my leave", "leave days",
    "holiday", "upcoming events", "company events", "calendar",
    "my points", "points balance", "my badges", "my streak",
    "my assets", "assigned assets", "what assets", "what equipment",
    "which assets", "which equipment", "assigned to me",
    "my training", "enrolled training", "my documents", "recent documents",
  ];
  return employeeKeywords.some(k => lower.includes(k));
}

function buildEmployeeAnswer(info: EmployeeDbInfo, message: string): string | null {
  const lower = message.toLowerCase();

  if (lower.includes("who is my manager") || lower.includes("who manages me") || lower.includes("who is my reporting")) {
    return info.manager
      ? `Your manager is ${info.manager}.`
      : "You don't have a manager assigned yet. Please contact HR.";
  }

  if (lower.includes("what is my role") || lower.includes("what is my job") || lower.includes("what is my title") || lower.includes("my job title")) {
    return `Your role is **${info.job_title}** in the **${info.department}** department.`;
  }

  if (lower.includes("what department") || lower.includes("which department") || lower.includes("my department")) {
    return `You are in the **${info.department}** department.`;
  }

  if (lower.includes("my progress") || lower.includes("onboarding progress") || (lower.includes("how") && lower.includes("onboarding"))) {
    const totalTasks = info.pending_tasks.length + info.overdue_tasks.length;
    return [
      `Your onboarding progress is **${info.progress}%**.`,
      totalTasks > 0 ? `You have **${totalTasks} task(s)** remaining.` : "All tasks are completed!",
      info.overdue_tasks.length > 0 ? `⚠️ ${info.overdue_tasks.length} task(s) are overdue.` : "",
    ].filter(Boolean).join(" ");
  }

  if (lower.includes("my tasks") || lower.includes("tasks left") || lower.includes("tasks do i") || lower.includes("my onboarding") && lower.includes("task")) {
    if (info.pending_tasks.length === 0) {
      return "You have no pending tasks. All onboarding tasks are completed!";
    }
    const lines = info.pending_tasks.map(t =>
      `- **${t.title}** (Due: ${t.due_date ? new Date(t.due_date).toLocaleDateString() : "N/A"})`
    );
    return `You have **${info.pending_tasks.length}** pending task(s):\n${lines.join("\n")}`;
  }

  if (lower.includes("overdue")) {
    if (info.overdue_tasks.length === 0) {
      return "You have no overdue tasks. Great job!";
    }
    const lines = info.overdue_tasks.map(t =>
      `- **${t.title}** (Due: ${t.due_date ? new Date(t.due_date).toLocaleDateString() : "N/A"})`
    );
    return `You have **${info.overdue_tasks.length}** overdue task(s):\n${lines.join("\n")}`;
  }

   if (lower.includes("my requests") || lower.includes("my support") || lower.includes("open requests") || lower.includes("what requests")) {
     if (info.open_requests.length === 0) {
       return "You have no open support requests.";
     }
     const lines = info.open_requests.map(r =>
       `- **${r.type}** (${r.category}) — Priority: ${r.priority}`
     );
     return `You have **${info.open_requests.length}** open support request(s):\n${lines.join("\n")}`;
   }

   // Leave balance queries
   if (lower.includes("leave balance") || lower.includes("how many leave") || lower.includes("leave available") || lower.includes("vacation balance") || lower.includes("pto balance")) {
     if (!info.leaveBalances) {
       return "I don't have your leave information available.";
     }
     const lines = [];
     if (info.leaveBalances.annual.available > 0) lines.push(`Annual: ${info.leaveBalances.annual.available} days`);
     if (info.leaveBalances.sick.available > 0) lines.push(`Sick: ${info.leaveBalances.sick.available} days`);
     if (info.leaveBalances.casual.available > 0) lines.push(`Casual: ${info.leaveBalances.casual.available} days`);
     if (info.leaveBalances.unpaid.available > 0) lines.push(`Unpaid: ${info.leaveBalances.unpaid.available} days`);
     if (info.leaveBalances.other.available > 0) lines.push(`Other: ${info.leaveBalances.other.available} days`);
     if (lines.length === 0) {
       return "You have no leave days available.";
     }
     return `Your available leave balance:\n${lines.join("\n")}`;
   }

   if (lower.includes("casual") && (lower.includes("leave") || lower.includes("leaves")) && (lower.includes("balance") || lower.includes("available") || lower.includes("left") || lower.includes("how many") || lower.includes("do i have"))) {
     if (!info.leaveBalances) {
       return "I don't have your leave information available.";
     }
     return `You have ${info.leaveBalances.casual.available} casual leave day(s) available.`;
   }

   if (lower.includes("annual") && (lower.includes("leave") || lower.includes("leaves")) && (lower.includes("balance") || lower.includes("available") || lower.includes("left") || lower.includes("how many") || lower.includes("do i have"))) {
     if (!info.leaveBalances) {
       return "I don't have your leave information available.";
     }
     return `You have ${info.leaveBalances.annual.available} annual leave day(s) available.`;
   }

   if (lower.includes("sick") && (lower.includes("leave") || lower.includes("leaves")) && (lower.includes("balance") || lower.includes("available") || lower.includes("left") || lower.includes("how many") || lower.includes("do i have"))) {
     if (!info.leaveBalances) {
       return "I don't have your leave information available.";
     }
     return `You have ${info.leaveBalances.sick.available} sick leave day(s) available.`;
   }

   // Assigned assets queries
   if (lower.includes("my assets") || lower.includes("assigned assets") || lower.includes("assets assigned") || lower.includes("what assets") || lower.includes("which assets") || lower.includes("equipment assigned") || lower.includes("laptop assigned") || lower.includes("what equipment") || lower.includes("which equipment") || lower.includes("assigned to me")) {
     if (!info.assignedAssets || info.assignedAssets.length === 0) {
       return "You have no assets currently assigned to you.";
     }
     const lines = info.assignedAssets.map(a =>
       `- **${a.name}** (${a.type})${a.serial_number ? ` - Serial: ${a.serial_number}` : ""} - Status: ${a.status}`
     );
     return `You have **${info.assignedAssets.length}** assigned asset(s):\n${lines.join("\n")}`;
   }

   if (lower.includes("laptop") || lower.includes("computer") || lower.includes("monitor")) {
     if (!info.assignedAssets || info.assignedAssets.length === 0) {
       return "You have no assets currently assigned to you.";
     }
     const matches = info.assignedAssets.filter(a =>
       a.type.toLowerCase().includes("laptop") ||
       a.type.toLowerCase().includes("computer") ||
       a.type.toLowerCase().includes("monitor")
     );
     if (matches.length === 0) {
       return "You don't have a laptop/computer/monitor assigned to you.";
     }
     const lines = matches.map(a =>
       `- **${a.name}** (${a.type})${a.serial_number ? ` - Serial: ${a.serial_number}` : ""} - Status: ${a.status}`
     );
     return `Your assigned device(s):\n${lines.join("\n")}`;
   }

   // Training queries
   if (lower.includes("my training") || lower.includes("enrolled training") || lower.includes("what training") || lower.includes("courses enrolled") || lower.includes("training progress")) {
     if (!info.enrolledCourses || info.enrolledCourses.length === 0) {
       return "You are not currently enrolled in any training courses.";
     }
     const lines = info.enrolledCourses.map(c =>
       `- **${c.title}** (Progress: ${c.progress}%, Status: ${c.status})${c.mandatory ? " (Mandatory)" : ""}`
     );
     return `You are enrolled in **${info.enrolledCourses.length}** training course(s):\n${lines.join("\n")}`;
   }

    if (lower.includes("training available") || lower.includes("available courses") || lower.includes("what courses")) {
      // This would require fetching all courses, which we don't have in info. We'll suggest checking the training page.
      return "To see available training courses, please visit the Training page.";
    }

    // Document queries
    if (lower.includes("my documents") || lower.includes("documents i have") || lower.includes("recent documents")) {
      if (!info.recentDocuments || info.recentDocuments.length === 0) {
        return "You have no recently accessed documents.";
      }
      const lines = info.recentDocuments.map(doc =>
        `- **${doc.title}**${doc.file_name ? ` (${doc.file_name})` : ""} - Uploaded: ${doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : "Unknown date"}`
      );
      return `You have **${info.recentDocuments.length}** recently accessed document(s):\n${lines.join("\n")}`;
    }

    if (lower.includes("document") || lower.includes("files")) {
      // This would require fetching all documents, which we don't have in info. We'll suggest checking the documents page.
      return "To see your documents, please visit the Documents page.";
    }

    // Calendar queries
   if (lower.includes("next holiday") || lower.includes("when is the next holiday") || lower.includes("next public holiday")) {
     if (!info.upcomingEvents || info.upcomingEvents.length === 0) {
       return "There are no upcoming holidays in the current month.";
     }
     const holidays = info.upcomingEvents.filter(e => e.type === "holiday");
     if (holidays.length === 0) {
       return "There are no upcoming holidays in the current month.";
     }
     // Find the soonest holiday
     const soonest = holidays.reduce((prev, current) => {
       const prevDate = prev.date ? new Date(prev.date) : new Date(0);
       const currDate = current.date ? new Date(current.date) : new Date(0);
       return prevDate < currDate ? prev : current;
     }, holidays[0]);
     return `The next holiday is **${soonest.title}** on ${new Date(soonest.date).toLocaleDateString()}.`;
   }

   if (lower.includes("calendar") || lower.includes("upcoming events") || lower.includes("company events") || lower.includes("holiday") || lower.includes("event")) {
     if (!info.upcomingEvents || info.upcomingEvents.length === 0) {
       return "There are no upcoming company events in the current month.";
     }
     const lines = info.upcomingEvents.map(e =>
       `- **${e.title}** (${e.type})${e.all_day ? " (All Day)" : ""} ${e.date ? new Date(e.date).toLocaleDateString() : ""}${e.time ? ` at ${e.time}` : ""}`
     );
     return `Upcoming events this month:\n${lines.join("\n")}`;
   }

   // Gamification queries
   if (lower.includes("my points") || lower.includes("points balance") || lower.includes("how many points") || lower.includes("score")) {
     if (!info.gamification) {
       return "I don't have your gamification information available.";
     }
     return `You have **${info.gamification.points}** points.`;
   }

   if (lower.includes("my badges") || lower.includes("badges earned") || lower.includes("how many badges") || lower.includes("badges")) {
     if (!info.gamification) {
       return "I don't have your gamification information available.";
     }
     return `You have earned **${info.gamification.badgesEarned}** badge(s).`;
   }

   if (lower.includes("my streak") || lower.includes("streak")) {
     return `Your current streak is ${info.current_streak || 0} day(s) (best: ${info.best_streak || 0}).`;
   }

   // General employee info
   if ((lower.includes("tell me about") && lower.includes("me")) || lower.includes("my information") || lower.includes("my profile")) {
     return [
       `**Name:** ${info.full_name}`,
       `**Email:** ${info.email}`,
       `**Role:** ${info.job_title}`,
       `**Department:** ${info.department}`,
       info.manager ? `**Manager:** ${info.manager}` : null,
       `**Progress:** ${info.progress}%`,
       `**Status:** ${info.risk_level === "green" ? "On Track" : info.risk_level === "yellow" ? "Needs Attention" : "High Risk"}`,
     ].filter(Boolean).join("\n");
   }

   return null;
}

export async function chat(
  messages: ChatMessage[],
  userId: string,
  companyId: string,
  employeeId?: string
): Promise<{
  response: string;
  intent?: RequestIntent | null;
  sources?: { title: string; content: string; section?: string; source?: string; similarity?: number }[];
}> {
  const lastMessage = messages[messages.length - 1]?.content || "";

  // ── Phase 6: Employee-specific questions (structured DB data) ──
  if (employeeId && isEmployeeQuery(lastMessage)) {
    const empInfo = await fetchEmployeeDbInfo(employeeId);
    if (empInfo) {
      const answer = buildEmployeeAnswer(empInfo, lastMessage);
      if (answer) {
        const intent = detectIntent(lastMessage);
        return { response: answer, intent };
      }
    }
  }

   // Gather employee context for the system prompt
   let employeeContext = "";
   if (employeeId) {
     const empInfo = await fetchEmployeeDbInfo(employeeId);
     if (empInfo) {
       employeeContext = [
         `Name: ${empInfo.full_name}`,
         `Role: ${empInfo.job_title}`,
         `Department: ${empInfo.department}`,
         empInfo.manager ? `Manager: ${empInfo.manager}` : null,
         `Onboarding Progress: ${empInfo.progress}%`,
         `Risk Level: ${empInfo.risk_level}`,
         empInfo.pending_tasks.length > 0 ? `Pending Tasks: ${empInfo.pending_tasks.map(t => t.title).join(", ")}` : null,
         empInfo.overdue_tasks.length > 0 ? `Overdue Tasks: ${empInfo.overdue_tasks.map(t => t.title).join(", ")}` : null,
         empInfo.open_requests.length > 0 ? `Open Requests: ${empInfo.open_requests.map(r => r.type).join(", ")}` : null,
         empInfo.leaveBalances ? `Leave Balance: Annual ${empInfo.leaveBalances.annual.available}days, Sick ${empInfo.leaveBalances.sick.available}days, Casual ${empInfo.leaveBalances.casual.available}days` : null,
         empInfo.assignedAssets && empInfo.assignedAssets.length > 0 ? `Assigned Assets: ${empInfo.assignedAssets.length} item(s)` : null,
         empInfo.enrolledCourses && empInfo.enrolledCourses.length > 0 ? `Enrolled Courses: ${empInfo.enrolledCourses.length} course(s)` : null,
         empInfo.recentDocuments && empInfo.recentDocuments.length > 0 ? `Recent Documents: ${empInfo.recentDocuments.length} document(s)` : null,
         empInfo.upcomingEvents && empInfo.upcomingEvents.length > 0 ? `Upcoming Events: ${empInfo.upcomingEvents.length} event(s)` : null,
         empInfo.current_streak !== undefined && empInfo.best_streak !== undefined ? `Streak: ${empInfo.current_streak} day(s) (best: ${empInfo.best_streak})` : null,
         empInfo.gamification ? `Gamification: ${empInfo.gamification.points} points, ${empInfo.gamification.badgesEarned} badges` : null,
       ].filter(Boolean).join("\n");
     }
   }

  // Get company-specific knowledge context via RAG
  const { context: ragContext, sources } = await getCompanyKnowledgeContext(
    lastMessage,
    companyId
  );

  // Build system prompt per Phase 5 requirements
  const systemPrompt = `You are OnboardAI, the employee onboarding assistant for the authenticated user's organization.

IMPORTANT RULES:
1. Answer company-specific questions ONLY using the supplied company context below.
2. NEVER invent company policies, benefits, leave allowances, procedures, deadlines, or organizational information.
3. If the supplied information does NOT contain enough evidence to answer the question, state: "I don't have that information in our company records. Please contact HR for details."
4. Keep answers concise and useful.
5. When company sources are available, cite them — mention the policy name or document title.

${ragContext ? `COMPANY INFORMATION:\n${ragContext}` : "No company policy information is available for this query."}

${employeeContext ? `EMPLOYEE CONTEXT:\n${employeeContext}` : ""}

Guidelines:
- If the user mentions an issue needing action (e.g., "I don't have GitHub access", "My laptop is broken"), flag the intent for confirmation.
- DO NOT create any requests automatically. Always wait for user confirmation.`;

  // Check for intent in the message
  const intent = detectIntent(lastMessage);
  const geminiApiKey = getEnvVars().geminiApiKey;

  if (geminiApiKey) {
    try {
      // Include conversation history for context (last 6 messages)
      const history = messages.slice(-6, -1).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: systemPrompt }] },
              ...history,
              { role: "user", parts: [{ text: lastMessage }] },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 800,
            },
          }),
        }
      );

      if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return { response: text, intent, sources };
    } catch (error) {
      console.error("Gemini error, using rule-based fallback:", error);
    }
  }

  // Fallback: rule-based response
  return {
    response: getFallbackResponse(lastMessage, ragContext, employeeContext),
    intent,
    sources,
  };
}

function detectIntent(message: string): RequestIntent | null {
  const lower = message.toLowerCase();

  let category = "Other";
  let type = "General Request";
  let priority = "Medium";

  if (lower.includes("github") || lower.includes("gitlab") || lower.includes("git")) {
    category = "IT"; type = "GitHub Access"; priority = "Medium";
  } else if (lower.includes("laptop") || lower.includes("computer") || lower.includes("hardware") || lower.includes("monitor")) {
    category = "Equipment"; type = "Hardware Issue"; priority = "High";
  } else if (lower.includes("email") || lower.includes("company email") || lower.includes("outlook")) {
    category = "IT"; type = "Email Setup"; priority = "Medium";
  } else if (lower.includes("vpn") || lower.includes("database") || lower.includes("server access") || lower.includes("ssh")) {
    category = "Access"; type = "System Access"; priority = "High";
  } else if (lower.includes("hris") || lower.includes("payroll") || lower.includes("benefits") || lower.includes("slack") || lower.includes("jira")) {
    category = "HR"; type = "HR System Access"; priority = "Medium";
  } else if (lower.includes("access") && (lower.includes("need") || lower.includes("don't have") || lower.includes("not have") || lower.includes("missing"))) {
    category = "Access"; type = "Access Request"; priority = "Medium";
  } else if (lower.includes("software") || lower.includes("install") || lower.includes("license")) {
    category = "IT"; type = "Software Request"; priority = "Medium";
   } else if (lower.includes("leave") && (lower.includes("apply") || lower.includes("request") || lower.includes("take"))) {
     category = "HR"; type = "Leave Request"; priority = "Medium";
   } else if (lower.includes("asset") && (lower.includes("request") || lower.includes("assign") || lower.includes("get") || lower.includes("need"))) {
     category = "Equipment"; type = "Asset Request"; priority = "Medium";
   } else if (lower.includes("training") && (lower.includes("enroll") || lower.includes("sign up") || lower.includes("take"))) {
     category = "HR"; type = "Training Request"; priority = "Medium";
   } else if (lower.includes("badge") || lower.includes("keycard") || lower.includes("building") || lower.includes("office access")) {
    category = "Access"; type = "Physical Access"; priority = "Medium";
  } else {
    return null;
  }

  return { category, type, description: message, priority };
}

function getFallbackResponse(message: string, context: string, employeeContext?: string): string {
  const lower = message.toLowerCase();

  if (context) {
    return `Based on company information:\n\n${context.substring(0, 500)}`;
  }

  if (employeeContext) {
    return `Here's what I know about you:\n${employeeContext}`;
  }

  if (lower.includes("leave") || lower.includes("vacation") || lower.includes("holiday") || lower.includes("pto")) {
    return "I don't have specific leave policy information in our current records. Please contact HR for detailed leave policy information.";
  }

  if (lower.includes("work from home") || lower.includes("wfh") || lower.includes("remote")) {
    return "I don't have specific work from home policy information in our current records. Please contact HR for details.";
  }

  if (lower.includes("training") || lower.includes("learning")) {
    return "I don't have specific training information. Please check your onboarding plan or contact HR.";
  }

  if (lower.includes("github") || lower.includes("access") || lower.includes("laptop") || lower.includes("email")) {
    return "It sounds like you need an access request or support. Would you like me to create a support request for this?";
  }

  return "I don't have that information in our company records. Please contact HR for details. If you need to report an issue, let me know and I can help create a support request.";
}