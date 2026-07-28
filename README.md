# OnboardAI — Intelligent Employee Onboarding & Support

A production-oriented multi-tenant SaaS application for automating employee onboarding, tracking progress, answering HR/policy questions with AI (RAG pipeline), detecting at-risk employees, and managing support requests.

## Features

- **Multi-Tenant Architecture** — Company-specific data isolation via `company_id`
- **Supabase Auth** — Email/password authentication with role-based access (Admin/HR/Manager/Employee)
- **HR Dashboard** — KPI cards, progress charts, risk distribution, AI insights, employee table
- **Employee Management** — Add employees with auto-generated onboarding tasks based on role/department
- **Onboarding Portals** — Role and department-specific task checklists with progress tracking
- **AI Assistant** — RAG-based Q&A using company policies with source citations
- **Intelligent Request Creation** — AI detects support needs and prompts confirmation before creating
- **Deterministic Risk Engine** — Score employees Green/Yellow/Red based on real progress, overdue tasks, and requests
- **Support Requests** — HR/IT request management with status workflow and filters
- **Analytics** — Charts for completion by department, risk distribution, trends, request categories
- **Company Administration** — Company profile, departments, roles, policies
- **Policy Management** — CRUD for company policies with RAG indexing
- **Document Upload** — Upload policy documents to Supabase Storage (infrastructure ready)
- **Demo Mode** — Fully functional without Supabase using in-memory data provider

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI | Custom components + Lucide icons + Recharts |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth (session cookies) |
| AI Chat | Google Gemini 1.5 Flash (with RAG) |
| Embeddings | Google text-embedding-004 (with pgvector) |
| Vector Search | pgvector (cosine similarity via `match_policy_chunks`) |
| Validation | Zod (available) |
| Storage | Supabase Storage (policy documents) |

## Architecture

```
Browser → Next.js API Routes → Service Layer → Supabase (PostgreSQL + Auth)
                                          ↓
                                    RAG Pipeline → Gemini AI
```

Each request:
1. Authenticates via Supabase session cookie
2. Determines user's company_id and role
3. Queries database with company_id filter (enforced by RLS)
4. Returns data scoped to the authenticated user's company

See `ARCHITECTURE.md` for detailed system design.

## Local Setup

### Prerequisites

- Node.js 18+
- npm

### Quick Start (Demo Mode)

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). No environment variables needed.

### Demo Login

| Email | Role |
|-------|------|
| hr@onboardai.com | HR Admin |
| rahul.sharma@onboardai.com | Employee (Engineering) |
| priya.patel@onboardai.com | Employee (Engineering) |
| arjun.kumar@onboardai.com | Employee (Engineering) |

You can also click **HR Demo Login** or **Employee Demo Login** on the landing page.

### Production Setup

#### 1. Supabase Project

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Enable pgvector in the SQL editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Run migration:
   ```bash
   # Copy contents of scripts/migration.sql and run in Supabase SQL editor
   ```
4. Run seed data:
   ```bash
   # Copy contents of scripts/seed.sql and scripts/seed-auth.sql and run in Supabase SQL editor
   ```
5. Run RAG function:
   ```bash
   # Copy contents of scripts/rag-function.sql and run in Supabase SQL editor
   ```
6. Enable email/password auth in Supabase Auth settings

#### 2. Environment Variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
NEXT_PUBLIC_APP_NAME=OnboardAI
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### 3. Gemini API

1. Get an API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Set `GEMINI_API_KEY` in `.env.local`

The app uses Gemini for:
- Chat completion (`gemini-1.5-flash`)
- Text embeddings (`text-embedding-004`) for RAG vector search

#### 4. Create Users

Create users via Supabase Auth dashboard or signup API, then link profiles:
```sql
INSERT INTO profiles (id, company_id, full_name, role)
VALUES ('<auth-user-id>', '00000000-0000-0000-0000-000000000001', 'HR Admin', 'hr');
```

## Database

### Tables (14)

- `companies` — Multi-tenant root
- `profiles` — User profiles with role + company_id
- `departments` — Company departments
- `employees` — Employee records
- `onboarding_templates` — Template definitions
- `onboarding_tasks` — Template task definitions
- `employee_tasks` — Per-employee assigned tasks
- `company_policies` — Policy documents
- `policy_documents` — Uploaded file metadata
- `policy_chunks` — Chunked/embedded content (pgvector)
- `support_requests` — HR/IT tickets
- `notifications` — User notifications
- `activity_logs` — Audit trail

All company-owned tables have `company_id` and RLS policies ensuring tenant isolation.

### Migrations

| File | Purpose |
|------|---------|
| `scripts/migration.sql` | Full schema, indexes, RLS policies |
| `scripts/rag-function.sql` | pgvector similarity search function |
| `scripts/seed.sql` | Demo company, departments, policies, templates |
| `scripts/seed-auth.sql` | Demo employees, support requests, activity logs |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── app/
│   ├── api/               # API routes (auth, chat, employees, requests, tasks, documents)
│   ├── analytics/         # Analytics page
│   ├── assistant/         # AI assistant chat
│   ├── company/           # Company admin page
│   ├── dashboard/         # HR & Employee dashboard
│   ├── employees/         # Employee list and detail
│   ├── login/             # Login page
│   ├── onboarding/        # Employee onboarding checklist
│   ├── policies/          # Policy management
│   ├── requests/          # Support requests
│   └── settings/          # Settings
├── components/
│   ├── dashboard/         # KPI card
│   ├── layout/            # Sidebar, navbar, app layout
│   └── ui/                # Reusable components
├── lib/
│   ├── services/          # Production service layer (auth, employees, tasks, requests, policies, rag, risk, ai)
│   ├── supabase.ts        # Client-safe Supabase client
│   ├── supabase-server.ts # Server-only Supabase client (SSR)
│   ├── demo-service.ts    # In-memory demo data service
│   ├── risk-engine.ts     # Deterministic risk algorithm
│   ├── ai.ts              # Legacy AI service
│   └── utils.ts           # Utility functions
├── data/
│   ├── demo-data.ts       # Seed data
│   ├── policies.ts        # Demo company policies
│   └── templates.ts       # Onboarding task templates
├── types/                 # TypeScript definitions
├── proxy.ts               # Route protection (Next.js 16 proxy)
scripts/                   # Database migrations
```

## Testing

Currently no automated tests. Manual test workflow:
1. Run `npm run build` to verify compilation
2. Run `npm run dev` to start dev server
3. Test demo mode: navigate to /login, use demo quick login
4. Test production mode: set Supabase env vars, create users, login

## Deployment

### Vercel

```bash
npm run build
npx vercel --prod
```

Set all environment variables in Vercel dashboard.

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Key Design Decisions

1. **Demo mode is always available**: The app works without any external services. Useful for evaluation and development.
2. **Deterministic risk scoring**: The LLM never assigns risk scores. Scores are calculated from real data; Gemini only writes human-readable recommendations.
3. **Company isolation at every layer**: company_id on all tables + RLS policies + server-side query filtering.
4. **Graceful degradation**: If Gemini fails, falls back to rule-based responses. If Supabase fails, demo mode auto-activates.
5. **Server-side auth enforcement**: All API routes validate authentication and authorization before returning data.

## License

Private / Proprietary — For evaluation purposes only.
