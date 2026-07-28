import { getCompanyKnowledgeContext } from "./rag";
import { createServerClient } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
}

async function fetchEmployeeDbInfo(employeeId: string): Promise<EmployeeDbInfo | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data: emp } = await supabase
    .from("employees")
    .select("full_name, email, job_title, department, manager, progress, risk_level, joining_date")
    .eq("id", employeeId)
    .single();

  if (!emp) return null;

  const { data: tasks } = await supabase
    .from("employee_tasks")
    .select("title, due_date, category, completed")
    .eq("employee_id", employeeId);

  const { data: requests } = await supabase
    .from("support_requests")
    .select("type, category, priority, status")
    .eq("employee_id", employeeId);

  const now = new Date().toISOString();
  const pendingTasks = (tasks || [])
    .filter((t: { completed: boolean }) => !t.completed)
    .map((t: { title: string; due_date: string; category: string }) => ({ title: t.title, due_date: t.due_date, category: t.category }));

  const overdueTasks = pendingTasks.filter(
    (t: { due_date: string }) => t.due_date && t.due_date < now
  );

  const openRequests = (requests || [])
    .filter((r: { status: string }) => r.status !== "Resolved")
    .map((r: { type: string; category: string; priority: string }) => ({ type: r.type, category: r.category, priority: r.priority }));

  return {
    full_name: emp.full_name,
    email: emp.email,
    job_title: emp.job_title,
    department: emp.department,
    manager: emp.manager || "",
    progress: emp.progress,
    risk_level: emp.risk_level,
    joining_date: emp.joining_date,
    pending_tasks: pendingTasks,
    overdue_tasks: overdueTasks,
    open_requests: openRequests,
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
  if (employeeId && isSupabaseConfigured) {
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

  if (GEMINI_API_KEY) {
    try {
      // Include conversation history for context (last 6 messages)
      const history = messages.slice(-6, -1).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
