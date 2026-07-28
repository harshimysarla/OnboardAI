import { CompanyPolicy } from "@/types";

export const companyPolicies: Omit<CompanyPolicy, "id" | "created_at">[] = [
  {
    title: "Leave Policy",
    category: "HR",
    content: `Our leave policy provides the following annual leave entitlement:

- Casual Leave: 12 days per year. Can be taken for personal reasons, no prior approval needed for up to 2 days.
- Sick Leave: 10 days per year. Medical certificate required for absences longer than 2 consecutive days.
- Earned Leave: 15 days per year. Can be accumulated up to 45 days.
- Public Holidays: 10 fixed public holidays per year.
- Maternity Leave: 26 weeks as per government regulations.
- Paternity Leave: 2 weeks.

All leave must be recorded in the HR system. Unused casual leave lapses at year-end.`,
  },
  {
    title: "Work From Home Policy",
    category: "HR",
    content: `Our Work From Home (WFH) policy:

- Employees can work from home up to 2 days per week with manager approval.
- WFH requests must be submitted at least 24 hours in advance.
- Core working hours (10 AM - 4 PM) must be observed even when working from home.
- Employees must be reachable via company communication tools during working hours.
- All WFH arrangements are subject to role suitability and manager discretion.
- Extended WFH (more than 2 days) requires HR approval.`,
  },
  {
    title: "Working Hours",
    category: "HR",
    content: `Standard working hours are:

- Monday to Friday: 9:00 AM to 6:00 PM
- Lunch break: 1 hour (between 12:00 PM and 2:00 PM)
- Core hours: 10:00 AM to 4:00 PM (all team members must be available)
- Flexible start: Employees may start between 8:00 AM and 10:00 AM
- Overtime: As per company policy and local regulations
- Weekend work: Not expected unless specifically required and compensated`,
  },
  {
    title: "Information Security Policy",
    category: "IT",
    content: `Key information security guidelines:

- Use strong passwords (minimum 12 characters, mixed case, numbers, special chars)
- Change passwords every 90 days
- Enable two-factor authentication on all company accounts
- Do not share passwords or access credentials with anyone
- Company devices must have encryption enabled
- Report security incidents within 1 hour to IT security team
- Do not install unauthorized software on company devices
- Company data must not be stored on personal devices
- VPN must be used when accessing company resources remotely
- Lock your workstation when away from your desk`,
  },
  {
    title: "Employee Conduct Policy",
    category: "HR",
    content: `Expected standards of conduct:

- Treat all colleagues with respect and professionalism
- Zero tolerance for discrimination or harassment
- Maintain confidentiality of company and client information
- Avoid conflicts of interest
- Comply with all applicable laws and regulations
- Professional dress code during business hours
- Responsible use of company resources and time
- Report any policy violations to HR or through the ethics hotline`,
  },
  {
    title: "IT Access Policy",
    category: "IT",
    content: `IT access provisioning:

- New employees receive basic access on Day 1 (email, internal portal)
- Role-specific access is granted within the first week
- Access requests must be approved by the reporting manager
- Sensitive systems require additional security clearance
- Access is revoked within 24 hours of employee exit
- Regular access audits are conducted quarterly
- GitHub access requires manager approval and 2FA setup
- Database and production access is granted only to authorized personnel`,
  },
  {
    title: "Expense Reimbursement Policy",
    category: "Finance",
    content: `Expense reimbursement guidelines:

- Submit expense reports within 30 days of expense date
- Attach original receipts for all expenses above $25
- Travel expenses require pre-approval from manager
- Mileage reimbursement at $0.58 per mile
- Meals reimbursed up to $50 per day for business travel
- Client entertainment requires VP approval above $200
- Expenses are processed within 15 business days of submission
- Misreported expenses may result in disciplinary action`,
  },
  {
    title: "Employee Benefits",
    category: "HR",
    content: `We offer the following benefits:

- Health insurance (medical, dental, vision) from Day 1
- Life insurance: 2x annual salary
- Annual performance bonus: up to 20% of salary
- Learning & development budget: $2,000 per year
- Gym membership reimbursement: up to $50/month
- Employee stock option plan (eligibility after 1 year)
- Flexible spending account for healthcare and dependent care
- Employee assistance program for mental health support`,
  },
];

export function getPolicyByTitle(title: string): string | undefined {
  const policy = companyPolicies.find(
    (p) => p.title.toLowerCase() === title.toLowerCase()
  );
  return policy?.content;
}

export function searchPolicies(query: string): string[] {
  const results: string[] = [];
  const lowerQuery = query.toLowerCase();
  for (const policy of companyPolicies) {
    if (
      policy.title.toLowerCase().includes(lowerQuery) ||
      policy.content.toLowerCase().includes(lowerQuery)
    ) {
      results.push(`**${policy.title}**\n${policy.content}`);
    }
  }
  return results;
}