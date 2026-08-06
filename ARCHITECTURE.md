# OnboardAI — System Architecture

This document describes the production architecture of OnboardAI: a multi-tenant employee onboarding & workforce support platform built with Next.js, MongoDB, and Google Gemini.

---

## 1. High-Level Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Browser — Next.js App Router (React 19, Tailwind CSS v4)    │
│  Dashboard · Assistant · Onboarding · Vault · HR pages       │
└──────────────────────────────┬───────────────────────────────┘
                               │  fetch() — httpOnly cookies
┌──────────────────────────────┴───────────────────────────────┐
│  Next.js Server                                               │
│                                                               │
│  API Route Handlers  (/api/**)                                │
│    │                                                          │
│    ├─ Auth Service ── requireAuth() · requireRole("admin")    │
│    │                  JWT verify (jose, HS256)                │
│    ├─ Service Layer (src/lib/services/*.ts)                   │
│    │   auth · employees · tasks · requests · policies · rag   │
│    │   risk · ai · leave · attendance · training · assets     │
│    │   vault · announcements · gamification · directory       │
│    └─ RAG Pipeline ── embed → search → prompt                 │
└──────────┬──────────────────────────────┬────────────────────┘
           ▼                              ▼
┌──────────────────────┐        ┌──────────────────────┐
│  MongoDB (Mongoose 9) │        │  Cloudinary          │
│  30+ collections,     │        │  raw file storage,   │
│  tenant-scoped        │        │  tenant-prefixed     │
└──────────────────────┘        └──────────────────────┘
```

---

## 2. Authentication & Sessions

- **Login contract**: company access code + email + password.
  - Code is normalized (`trim().toUpperCase()`) and looked up fresh in MongoDB on every attempt — code changes take effect immediately.
  - The user is then looked up **within that company only** (`email + company_id`), guaranteeing tenant isolation even with duplicate emails across companies.
- **Passwords**: bcrypt (10 rounds).
- **Tokens** (jose, HS256):
  - Access token: 1 hour, payload `{ role, companyId }`, subject = userId. **No company code inside the JWT** — tenant identity is always `companyId`.
  - Refresh token: 30 days, stored sha256-hashed in the `sessions` collection; rotation invalidates the previous session on each refresh.
- **Cookies**: `onboardai_token` / `onboardai_refresh` — httpOnly, sameSite=lax, path=/.
- **Guards**: `requireAuth()` → `requireRole("admin" | "hr" | "manager" | "employee")` used at the top of every protected route; authorization failures map to 401.

## 3. Multi-Tenancy

- Root entity: `companies` (name, slug, logo, `access_code`, office info, settings).
- Every tenant-owned collection carries `company_id` (30+ schemas in `src/lib/models.ts`).
- Every service query is scoped by `company_id` server-side. There is no client-side trust boundary; the browser never receives another tenant's data.
- Company Access Codes:
  - Auto-generated at signup: `<PREFIX>-<SUFFIX>` from company name (e.g. `MICRO-72KD`), unambiguous charset, unique index.
  - Admin-customizable: 3–20 chars of `A-Z 0-9 - _`, globally unique, uppercase-stored.
  - Change flow: `PATCH /api/company/access-code` (admin-only) → validate → uniqueness check → update → activity-log entry (old/new code, actor, IP) → notification to every company user.

## 4. Data Model (key collections)

| Collection | Purpose |
|------------|---------|
| `companies` | Tenant root; access code, settings |
| `users` | Auth + role (`admin`/`hr`/`manager`/`employee`) + company_id |
| `sessions` | Hashed refresh tokens for rotation |
| `employees` | HR profile per user (department, manager, join date) |
| `onboardingtemplates` / `onboardingtasks` | Template + task definitions |
| `employeetasks` | Per-employee assigned tasks (progress, completion) |
| `departments` | Org structure |
| `policies` / `policydocuments` / `policychunks` | Policy content + uploaded files + embedded chunks for RAG |
| `vaultdocuments` / `docversions` | Document vault with file metadata, hashes, versions |
| `supportrequests` | HR/IT tickets with status workflow |
| `leaverequests` / `leavebalances` | Leave lifecycle |
| `attendancerecords` / `breakentries` | Check-in/out with breaks |
| `trainingcourses` / `trainingmaterials` / `trainingassignments` / `quizscores` | Training + quizzes |
| `assets` | Asset inventory |
| `announcements` / `announcementcomments` | Company communication |
| `companyevents` | Calendar: holidays, events, birthdays |
| `notifications` | Per-user notifications |
| `activitylogs` | Audit trail (action, details, IP) |
| `invitations` | Employee invites with access-code snapshot |

## 5. AI & RAG Pipeline

1. Employee asks a question in the Assistant.
2. The query is embedded with `text-embedding-004` (Gemini API).
3. Cosine similarity is computed against the **company's own** `policychunks` embeddings (stored in MongoDB).
4. Top-K chunks + employee context (tasks, leaves, requests, assets, training) build the system prompt.
5. `gemini-1.5-flash` answers **only from the retrieved context**, cites sources, and falls back to "contact HR" when no policy matches.
6. Intent detection extracts structured actions (e.g. confirming a support request, completing a task).

**Risk engine** is deliberately non-AI: Green/Yellow/Red scores derive deterministically from progress vs. expected, overdue mandatory tasks, unresolved requests, and days since joining.

## 6. Document Vault

- `POST /api/vault/upload` (multipart): auth → extension/MIME/size validation (15 types, 1 MB) → sanitized filename → sha256 content hash → duplicate check (409) → Cloudinary upload (`resource_type: raw`, tenant-prefixed folder) → document + version records.
- `GET /api/vault/download?id=…`: proxies the Cloudinary URL with the correct Content-Disposition and increments download count.
- Versioning: each upload to an existing document creates a `docversions` entry; downloads serve the current version.

## 7. Deployment Topology

- Next.js standalone on Vercel (or Docker) + MongoDB Atlas + Cloudinary + Google Generative Language API.
- Server-only secrets: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GEMINI_API_KEY`, Cloudinary credentials.
- Public config exposed via `NEXT_PUBLIC_*` only.

## 8. Quality Gates

- `npm test` — Vitest suite (validation, access codes, company access-code service + login isolation, vault upload, risk engine, RAG utilities).
- `npm run lint` — ESLint (next/core-web-vitals).
- `npm run build` — production compile; all routes must register.
