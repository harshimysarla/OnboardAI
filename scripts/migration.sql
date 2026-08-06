-- OnboardAI Production Schema
-- Run this in Supabase SQL editor

-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. Companies (multi-tenant root)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'hr', 'manager', 'employee')) DEFAULT 'employee',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Departments
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, name)
);

-- 5. Employees
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  job_title TEXT NOT NULL DEFAULT '',
  manager TEXT DEFAULT '',
  joining_date DATE NOT NULL,
  progress INTEGER DEFAULT 0,
  risk_level TEXT DEFAULT 'green' CHECK (risk_level IN ('green', 'yellow', 'red')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, email)
);

-- 6. Onboarding Templates
CREATE TABLE onboarding_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'company' CHECK (scope IN ('company', 'department', 'role')),
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  role_pattern TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Onboarding Tasks (template definitions)
CREATE TABLE onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES onboarding_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'day1' CHECK (category IN ('day1', 'first_week', 'first_month', 'custom')),
  mandatory BOOLEAN DEFAULT true,
  day_offset INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Employee Tasks (assigned instances)
CREATE TABLE employee_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'day1',
  mandatory BOOLEAN DEFAULT true,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  due_date DATE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Company Policies (human-readable)
CREATE TABLE company_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Policy Documents (uploaded files)
CREATE TABLE policy_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT DEFAULT '',
  file_size INTEGER DEFAULT 0,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Policy Chunks (for RAG / vector search)
CREATE TABLE policy_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID REFERENCES policy_documents(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES company_policies(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Support Requests
CREATE TABLE support_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL DEFAULT '',
  department TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Other' CHECK (category IN ('IT', 'HR', 'Access', 'Equipment', 'Documentation', 'Other')),
  type TEXT NOT NULL DEFAULT 'General Request',
  description TEXT NOT NULL DEFAULT '',
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Activity Logs
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. Indexes
CREATE INDEX idx_profiles_company ON profiles(company_id);
CREATE INDEX idx_employees_company ON employees(company_id);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employee_tasks_employee ON employee_tasks(employee_id);
CREATE INDEX idx_employee_tasks_company ON employee_tasks(company_id);
CREATE INDEX idx_support_requests_company ON support_requests(company_id);
CREATE INDEX idx_support_requests_employee ON support_requests(employee_id);
CREATE INDEX idx_support_requests_status ON support_requests(status);
CREATE INDEX idx_company_policies_company ON company_policies(company_id);
CREATE INDEX idx_policy_chunks_company ON policy_chunks(company_id);
CREATE INDEX idx_policy_chunks_embedding ON policy_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_activity_logs_company ON activity_logs(company_id);
CREATE INDEX idx_activity_logs_employee ON activity_logs(employee_id);
CREATE INDEX idx_notifications_profile ON notifications(profile_id);

-- 16. ROW LEVEL SECURITY

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's company_id
-- SECURITY DEFINER (with fixed search_path) so RLS on profiles does not recurse
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$;

-- Helper function to check user role
-- SECURITY DEFINER (with fixed search_path) so RLS on profiles does not recurse
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- RLS: Companies
CREATE POLICY "users can view their own company"
  ON companies FOR SELECT USING (
    id = get_user_company_id()
  );

CREATE POLICY "admins can update their company"
  ON companies FOR UPDATE USING (
    id = get_user_company_id() AND get_user_role() = 'admin'
  );

-- RLS: Profiles
CREATE POLICY "users can view profiles in their company"
  ON profiles FOR SELECT USING (
    company_id = get_user_company_id()
  );

CREATE POLICY "users can update own profile"
  ON profiles FOR UPDATE USING (
    id = auth.uid()
  );

-- RLS: Departments
CREATE POLICY "company access on departments"
  ON departments FOR ALL USING (
    company_id = get_user_company_id()
  );

-- RLS: Employees
CREATE POLICY "company access on employees"
  ON employees FOR ALL USING (
    company_id = get_user_company_id()
  );

-- RLS: Onboarding Templates
CREATE POLICY "company access on onboarding_templates"
  ON onboarding_templates FOR ALL USING (
    company_id = get_user_company_id()
  );

-- RLS: Onboarding Tasks
CREATE POLICY "company access on onboarding_tasks"
  ON onboarding_tasks FOR ALL USING (
    template_id IN (SELECT id FROM onboarding_templates WHERE company_id = get_user_company_id())
  );

-- RLS: Employee Tasks
CREATE POLICY "company access on employee_tasks"
  ON employee_tasks FOR ALL USING (
    company_id = get_user_company_id()
  );

CREATE POLICY "employees can update own tasks"
  ON employee_tasks FOR UPDATE USING (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
  );

-- RLS: Company Policies
CREATE POLICY "company access on company_policies"
  ON company_policies FOR ALL USING (
    company_id = get_user_company_id()
  );

-- RLS: Policy Documents
CREATE POLICY "company access on policy_documents"
  ON policy_documents FOR ALL USING (
    company_id = get_user_company_id()
  );

-- RLS: Policy Chunks
CREATE POLICY "company access on policy_chunks"
  ON policy_chunks FOR ALL USING (
    company_id = get_user_company_id()
  );

-- RLS: Support Requests
CREATE POLICY "company access on support_requests"
  ON support_requests FOR ALL USING (
    company_id = get_user_company_id()
  );

CREATE POLICY "employees can view own requests"
  ON support_requests FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
  );

-- RLS: Notifications
CREATE POLICY "company access on notifications"
  ON notifications FOR ALL USING (
    company_id = get_user_company_id()
  );

CREATE POLICY "users can view own notifications"
  ON notifications FOR SELECT USING (
    profile_id = auth.uid()
  );

-- RLS: Activity Logs
CREATE POLICY "company access on activity_logs"
  ON activity_logs FOR ALL USING (
    company_id = get_user_company_id()
  );

-- 17. Storage bucket for policy documents
INSERT INTO storage.buckets (id, name, public) VALUES ('policy_docs', 'policy_docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "company access on policy_docs storage"
  ON storage.objects FOR ALL USING (
    bucket_id = 'policy_docs' AND
    (storage.foldername(name))[1] = get_user_company_id()::text
  );
