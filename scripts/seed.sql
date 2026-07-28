-- OnboardAI Development Seed Data
-- Run this AFTER migration.sql in Supabase SQL editor
-- This creates one demo company with sample data

-- 1. Create demo company
INSERT INTO companies (id, name, slug, logo_url)
VALUES ('00000000-0000-0000-0000-000000000001', 'Acme Corp', 'acme-corp', NULL);

-- 2. Departments
INSERT INTO departments (id, company_id, name) VALUES
  ('d1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Engineering'),
  ('d1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'HR'),
  ('d1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Finance'),
  ('d1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Marketing'),
  ('d1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Operations');

-- 3. Company Policies
INSERT INTO company_policies (id, company_id, title, content, category) VALUES
('p1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Leave Policy',
'Our leave policy provides the following annual leave entitlement:
- Casual Leave: 12 days per year. Can be taken for personal reasons, no prior approval needed for up to 2 days.
- Sick Leave: 10 days per year. Medical certificate required for absences longer than 2 consecutive days.
- Earned Leave: 15 days per year. Can be accumulated up to 45 days.
- Public Holidays: 10 fixed public holidays per year.
- Maternity Leave: 26 weeks as per government regulations.
- Paternity Leave: 2 weeks.
All leave must be recorded in the HR system. Unused casual leave lapses at year-end.', 'HR'),

('p1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Work From Home Policy',
'Our Work From Home (WFH) policy:
- Employees can work from home up to 2 days per week with manager approval.
- WFH requests must be submitted at least 24 hours in advance.
- Core working hours (10 AM - 4 PM) must be observed even when working from home.
- Employees must be reachable via company communication tools during working hours.
- All WFH arrangements are subject to role suitability and manager discretion.
- Extended WFH (more than 2 days) requires HR approval.', 'HR'),

('p1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Working Hours',
'Standard working hours are:
- Monday to Friday: 9:00 AM to 6:00 PM
- Lunch break: 1 hour (between 12:00 PM and 2:00 PM)
- Core hours: 10:00 AM to 4:00 PM (all team members must be available)
- Flexible start: Employees may start between 8:00 AM and 10:00 AM
- Overtime: As per company policy and local regulations
- Weekend work: Not expected unless specifically required and compensated', 'HR'),

('p1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Information Security Policy',
'Key information security guidelines:
- Use strong passwords (minimum 12 characters, mixed case, numbers, special chars)
- Change passwords every 90 days
- Enable two-factor authentication on all company accounts
- Do not share passwords or access credentials with anyone
- Company devices must have encryption enabled
- Report security incidents within 1 hour to IT security team
- Do not install unauthorized software on company devices
- Company data must not be stored on personal devices
- VPN must be used when accessing company resources remotely
- Lock your workstation when away from your desk', 'IT'),

('p1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Employee Conduct Policy',
'Expected standards of conduct:
- Treat all colleagues with respect and professionalism
- Zero tolerance for discrimination or harassment
- Maintain confidentiality of company and client information
- Avoid conflicts of interest
- Comply with all applicable laws and regulations
- Professional dress code during business hours
- Responsible use of company resources and time
- Report any policy violations to HR or through the ethics hotline', 'HR'),

('p1000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'IT Access Policy',
'IT access provisioning:
- New employees receive basic access on Day 1 (email, internal portal)
- Role-specific access is granted within the first week
- Access requests must be approved by the reporting manager
- Sensitive systems require additional security clearance
- Access is revoked within 24 hours of employee exit
- Regular access audits are conducted quarterly
- GitHub access requires manager approval and 2FA setup
- Database and production access is granted only to authorized personnel', 'IT'),

('p1000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Expense Reimbursement Policy',
'Expense reimbursement guidelines:
- Submit expense reports within 30 days of expense date
- Attach original receipts for all expenses above $25
- Travel expenses require pre-approval from manager
- Mileage reimbursement at $0.58 per mile
- Meals reimbursed up to $50 per day for business travel
- Client entertainment requires VP approval above $200
- Expenses are processed within 15 business days of submission
- Misreported expenses may result in disciplinary action', 'Finance'),

('p1000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Employee Benefits',
'We offer the following benefits:
- Health insurance (medical, dental, vision) from Day 1
- Life insurance: 2x annual salary
- Annual performance bonus: up to 20% of salary
- Learning and development budget: $2,000 per year
- Gym membership reimbursement: up to $50/month
- Employee stock option plan (eligibility after 1 year)
- Flexible spending account for healthcare and dependent care
- Employee assistance program for mental health support', 'HR');

-- 4. Onboarding Templates
INSERT INTO onboarding_templates (id, company_id, name, scope) VALUES
  ('t0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Default Onboarding', 'company');

-- Base onboarding tasks
INSERT INTO onboarding_tasks (template_id, title, description, category, mandatory, day_offset, sort_order) VALUES
  ('t0000000-0000-0000-0000-000000000001', 'Complete employee profile', 'Fill in your personal details and emergency contacts', 'day1', true, 0, 1),
  ('t0000000-0000-0000-0000-000000000001', 'Submit required documents', 'Submit ID proof, address proof, and educational certificates', 'day1', true, 0, 2),
  ('t0000000-0000-0000-0000-000000000001', 'Read company policies', 'Review the employee handbook and company policies', 'day1', true, 0, 3),
  ('t0000000-0000-0000-0000-000000000001', 'Set up company email', 'Configure your company email account on your devices', 'day1', true, 0, 4),
  ('t0000000-0000-0000-0000-000000000001', 'Complete security training', 'Complete the mandatory information security awareness training', 'first_week', true, 3, 5),
  ('t0000000-0000-0000-0000-000000000001', 'Meet your manager', 'Schedule a 1:1 meeting with your reporting manager', 'first_week', true, 3, 6),
  ('t0000000-0000-0000-0000-000000000001', 'Configure work environment', 'Set up your development environment and necessary software', 'first_week', false, 5, 7),
  ('t0000000-0000-0000-0000-000000000001', 'Complete role-specific training', 'Complete training modules specific to your role', 'first_month', true, 14, 8),
  ('t0000000-0000-0000-0000-000000000001', 'First manager check-in', 'Attend the first formal check-in meeting with your manager', 'first_month', true, 21, 9),
  ('t0000000-0000-0000-0000-000000000001', 'Complete onboarding feedback', 'Fill in the onboarding feedback form', 'first_month', false, 28, 10);

-- NOTE: Employees and profiles are created by the application after signup.
-- Run `npm run seed` to create demo profiles and link them to employees.
