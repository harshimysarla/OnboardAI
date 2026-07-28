# OnboardAI Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (React/Next.js)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │
│  │ Dashboard │  │  Pages   │  │ Assistant│  │ Admin   │  │
│  └─────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘  │
│        │              │             │              │       │
│  ┌─────┴──────────────┴─────────────┴──────────────┴────┐ │
│  │              API Routes (fetch)                       │ │
│  └──────────────────────────┬───────────────────────────┘ │
└─────────────────────────────┼─────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────┐
│  Next.js Server             │                             │
│                    ┌────────┴────────┐                    │
│                    │   API Route     │                    │
│                    │   Handlers      │                    │
│                    └────────┬────────┘                    │
│                             │                             │
│             ┌───────────────┼───────────────┐             │
│             ▼               ▼               ▼             │
│  ┌──────────────────┐ ┌──────────┐ ┌──────────────┐      │
│  │ Service Layer     │ │ RAG      │ │ Auth Service  │      │
│  │ (employees,       │ │ Pipeline │ │ (Supabase     │      │
│  │  tasks, requests, │ │          │ │  Auth)        │      │
│  │  policies, risk)  │ │          │ │               │      │
│  └────────┬─────────┘ └────┬─────┘ └──────┬────────┘      │
│           │                │               │               │
│           ▼                ▼               ▼               │
│  ┌──────────────────────────────────────────────────┐     │
│  │           Supabase Client (PostgreSQL)            │     │
│  │  ┌────────────────────────────────────────────┐  │     │
│  │  │  RLS: tenant isolation via company_id      │  │     │
│  │  └────────────────────────────────────────────┘  │     │
│  └──────────────────────┬───────────────────────────┘     │
│                         │                                 │
│                         ▼                                 │
│  ┌──────────────────────────────────────────────────┐     │
│  │           PostgreSQL Database                     │     │
│  │  companies → profiles → employees → tasks        │     │
│  │  departments → policies → policy_chunks           │     │
│  │  support_requests → activity_logs                │     │
│  │  + pgvector for embedding search                  │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
│  ┌──────────────────────────────────────────────────┐     │
│  │           Google Gemini AI API                    │     │
│  │  - Chat completion (employee Q&A)                │     │
│  │  - Text embeddings (policy chunk search)          │     │
│  └──────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

## Data Flow

### Authenticated Request Flow
```
1. Browser → API Route
2. API Route → createServerClient() → Supabase Auth (session cookie)
3. getAuthenticatedUser() → Auth User + Profile (company_id, role)
4. Service Layer → Query with company_id filter
5. PostgreSQL → RLS enforces company isolation
6. Response → Browser
```

### RAG Question Flow
```
1. User asks question in Assistant
2. Chat API receives message + authenticated user context
3. getCompanyKnowledgeContext(query, companyId):
   a. Generate embedding from query (Gemini/text-embedding-004)
   b. Vector search: match_policy_chunks() pgvector function
   c. Filter by company_id → returns top K chunks
4. Build system prompt with:
   - Retrieved company policy chunks
   - Employee context (tasks, requests)
5. Send to Gemini (gemini-1.5-flash):
   - Instruction: answer ONLY from provided context
   - DO NOT invent policies
   - Return "unavailable" + "contact HR" if not found
6. Return response with source citations
```

### Risk Engine Flow
```
1. Trigger: HR views dashboard, employee detail, or scheduled
2. Load employee data + tasks + requests from DB
3. Calculate deterministic score based on:
   - Progress vs expected progress (by day)
   - Overdue mandatory tasks
   - Overdue total tasks
   - Unresolved support requests
   - Days since joining
4. Classify: <30=Green, 30-59=Yellow, 60+=Red
5. Generate human-readable recommendation (deterministic)
6. Store/display risk level, factors, recommendation
```

## Multi-Tenant Architecture

### Tenant Isolation Strategy

Every company-owned table has a `company_id` column:

| Table | company_id | RLS Policy |
|-------|-----------|------------|
| profiles | ✅ | SELECT: company match |
| employees | ✅ | ALL: company match |
| employee_tasks | ✅ | ALL: company match |
| departments | ✅ | ALL: company match |
| company_policies | ✅ | ALL: company match |
| policy_documents | ✅ | ALL: company match |
| policy_chunks | ✅ | ALL: company match |
| support_requests | ✅ | ALL: company match |
| activity_logs | ✅ | ALL: company match |
| notifications | ✅ | SELECT: profile match |

RLS helper functions:
- `get_user_company_id()` — returns current user's company
- `get_user_role()` — returns current user's role

### Role Hierarchy
```
admin  → full access, company settings, user management
hr     → employee management, onboarding, requests, analytics
manager → team dashboard, team progress, risk alerts
employee → personal dashboard, tasks, AI assistant
```

## Service Layer

Each domain has a dedicated service in `src/lib/services/`:

| Service | File | Key Functions |
|---------|------|---------------|
| Auth | `auth.ts` | `getAuthenticatedUser()`, `requireAuth()`, `requireRole()` |
| Employees | `employees.ts` | `getEmployees()`, `createEmployee()`, `getMyProfile()` |
| Tasks | `tasks.ts` | `getEmployeeTasks()`, `completeTask()` |
| Requests | `requests.ts` | `getSupportRequests()`, `createSupportRequest()` |
| Policies | `policies.ts` | `getCompanyPolicies()`, `createPolicy()`, `searchPolicies()` |
| RAG | `rag.ts` | `generateEmbedding()`, `indexPolicy()`, `queryCompanyKnowledge()` |
| Risk | `risk.ts` | `calculateEmployeeRisk()`, `getRiskAssessments()` |
| AI Chat | `ai.ts` | `chat()` — orchestrates RAG + Gemini |

## Database Schema

See `scripts/migration.sql` for the complete schema (14 tables with indexes, RLS, and triggers).

Key tables:
- `companies` — Root tenant entity
- `profiles` — Extends Supabase auth.users with role + company_id
- `employees` — Employee records linked to profiles
- `employee_tasks` — Per-employee task instances
- `company_policies` — Policy documents
- `policy_chunks` — Chunked + embedded policy content (pgvector)
- `support_requests` — HR/IT support tickets

## Demo vs Production Mode

The application auto-detects the mode:

- **Demo Mode** (default): No Supabase env vars needed. Uses in-memory DemoService with seed data. Auth via localStorage.
- **Production Mode**: Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Uses Supabase Auth + PostgreSQL. Auth via Supabase session cookies.

Detection: `isSupabaseConfigured` export from `@/lib/supabase`.

## Security

1. **Secrets**: Gemini API key and Supabase service role key are server-side only (never exposed to browser)
2. **Auth**: Supabase Auth with HTTP-only session cookies
3. **RLS**: Row Level Security on all tables prevents cross-tenant access
4. **Server auth**: API routes verify authentication + authorization before returning data
5. **Input validation**: Not yet implemented but Zod is available as a dependency
6. **CSRF**: Handled by Supabase Auth's built-in CSRF protection
7. **File uploads**: Stored in Supabase Storage with tenant-isolated paths
