-- OnboardAI Auth Seed Data
-- Run this AFTER migration.sql AND seed.sql in Supabase SQL editor
-- Creates auth users and links them to profiles and employees

-- NOTE: To create auth users, use the Supabase Auth admin API or dashboard.
-- The profiles and employees below can be linked after user signup.
-- This file provides the SQL to insert profiles once auth users exist.

-- Example: After creating users in Supabase Auth dashboard, map them here:
-- UPDATE profiles SET full_name = 'HR Admin', role = 'hr' WHERE id = '<auth-user-id>';
-- INSERT INTO employees (...) VALUES (...);

-- For development, create the demo employees that will be linked to auth users:
INSERT INTO employees (id, company_id, full_name, email, job_title, department_id, manager, joining_date, progress, risk_level)
VALUES
  ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Rahul Sharma', 'rahul@acme.com', 'Software Developer', 'd1000000-0000-0000-0000-000000000001', 'Anita Desai', '2025-01-15', 80, 'green'),
  ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Priya Patel', 'priya@acme.com', 'Frontend Engineer', 'd1000000-0000-0000-0000-000000000001', 'Anita Desai', '2025-02-01', 45, 'yellow'),
  ('e0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Arjun Kumar', 'arjun@acme.com', 'Backend Engineer', 'd1000000-0000-0000-0000-000000000001', 'Anita Desai', '2025-02-20', 25, 'red'),
  ('e0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Sneha Reddy', 'sneha@acme.com', 'HR Business Partner', 'd1000000-0000-0000-0000-000000000002', 'Vikram Singh', '2025-01-10', 90, 'green'),
  ('e0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Karan Mehta', 'karan@acme.com', 'Financial Analyst', 'd1000000-0000-0000-0000-000000000003', 'Deepak Joshi', '2025-02-10', 60, 'green'),
  ('e0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Ananya Iyer', 'ananya@acme.com', 'Marketing Specialist', 'd1000000-0000-0000-0000-000000000004', 'Rohit Verma', '2025-02-25', 35, 'yellow'),
  ('e0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Rohit Nair', 'rohit@acme.com', 'Operations Coordinator', 'd1000000-0000-0000-0000-000000000005', 'Sunita Rao', '2025-03-01', 15, 'red'),
  ('e0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Meera Joshi', 'meera@acme.com', 'DevOps Engineer', 'd1000000-0000-0000-0000-000000000001', 'Anita Desai', '2025-01-20', 70, 'green');

-- Support Requests
INSERT INTO support_requests (id, company_id, employee_id, employee_name, department, category, type, description, priority, status)
VALUES
  ('r0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Priya Patel', 'Engineering', 'IT', 'GitHub Access', 'Need access to the organization GitHub repository for project repositories.', 'Medium', 'Open'),
  ('r0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'Arjun Kumar', 'Engineering', 'Access', 'Database Access', 'Require read access to staging database for development.', 'High', 'In Progress'),
  ('r0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', 'Karan Mehta', 'Finance', 'IT', 'ERP Access', 'Need access to the financial reporting module in ERP system.', 'Medium', 'Resolved'),
  ('r0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000006', 'Ananya Iyer', 'Marketing', 'IT', 'Marketing Tools', 'Request access to HubSpot and Google Analytics accounts.', 'Low', 'Open'),
  ('r0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000007', 'Rohit Nair', 'Operations', 'Equipment', 'Laptop Issue', 'Laptop keyboard malfunctioning, need replacement.', 'Urgent', 'In Progress'),
  ('r0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000008', 'Meera Joshi', 'Engineering', 'Access', 'CI/CD Pipeline', 'Need access to deployment pipelines for the microservices.', 'Medium', 'Open'),
  ('r0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Rahul Sharma', 'Engineering', 'Documentation', 'API Docs', 'Internal API documentation access needed.', 'Low', 'Resolved'),
  ('r0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 'Sneha Reddy', 'HR', 'HR', 'HRIS Access', 'Full admin access to HRIS system required.', 'High', 'In Progress');

-- Activity Logs
INSERT INTO activity_logs (id, company_id, employee_id, action, details)
VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Completed task', 'Complete employee profile'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Completed task', 'Submit required documents'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Completed task', 'Read company policies'),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Completed task', 'Set up company email'),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Completed task', 'Complete security training'),
  ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Completed task', 'Complete employee profile'),
  ('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Completed task', 'Submit required documents'),
  ('a0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Created request', 'GitHub Access request'),
  ('a0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'Completed task', 'Complete employee profile'),
  ('a0000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'Created request', 'Database Access request');
