import { describe, it, expect } from "vitest";
import {
  authSchema,
  createEmployeeSchema,
  createRequestSchema,
  completeTaskSchema,
  chatSchema,
  createPolicySchema,
  searchParamsSchema,
  applyLeaveSchema,
  decideLeaveSchema,
  validate,
} from "@/lib/validation";

describe("authSchema", () => {
  it("accepts valid credentials with company code", () => {
    const result = authSchema.safeParse({
      company_code: "MICRO-6X91",
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts lowercase company code", () => {
    const result = authSchema.safeParse({
      company_code: "micro-6x91",
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing company code", () => {
    const result = authSchema.safeParse({ email: "test@example.com", password: "password123" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid company code format", () => {
    const result = authSchema.safeParse({
      company_code: "!!!",
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = authSchema.safeParse({
      company_code: "MICRO-6X91",
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = authSchema.safeParse({
      company_code: "MICRO-6X91",
      email: "test@example.com",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });
});

describe("createEmployeeSchema", () => {
  it("accepts valid employee data", () => {
    const result = createEmployeeSchema.safeParse({
      full_name: "John Doe",
      email: "john@example.com",
      joining_date: "2024-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = createEmployeeSchema.safeParse({ full_name: "John" });
    expect(result.success).toBe(false);
  });

  it("accepts employee with optional fields", () => {
    const result = createEmployeeSchema.safeParse({
      full_name: "Jane Doe",
      email: "jane@example.com",
      job_title: "Engineer",
      department: "Engineering",
      manager: "Bob",
      joining_date: "2024-03-01",
    });
    expect(result.success).toBe(true);
  });
});

describe("createRequestSchema", () => {
  it("accepts valid request", () => {
    const result = createRequestSchema.safeParse({
      employee_id: "emp-1",
      category: "IT",
      type: "Access Request",
      description: "Need GitHub access",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("Medium");
    }
  });

  it("rejects invalid category", () => {
    const result = createRequestSchema.safeParse({
      employee_id: "emp-1",
      category: "InvalidCategory",
      type: "Test",
      description: "Test",
    });
    expect(result.success).toBe(false);
  });
});

describe("completeTaskSchema", () => {
  it("accepts valid task completion", () => {
    const result = completeTaskSchema.safeParse({
      employee_id: "emp-1",
      task_id: "task-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fields", () => {
    const result = completeTaskSchema.safeParse({ employee_id: "emp-1" });
    expect(result.success).toBe(false);
  });
});

describe("chatSchema", () => {
  it("accepts valid chat messages", () => {
    const result = chatSchema.safeParse({
      messages: [{
        id: "1",
        role: "user",
        content: "Hello",
        created_at: new Date().toISOString(),
      }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty messages array", () => {
    const result = chatSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });
});

describe("createPolicySchema", () => {
  it("accepts valid policy", () => {
    const result = createPolicySchema.safeParse({
      title: "Leave Policy",
      content: "Full policy content here",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = createPolicySchema.safeParse({ content: "Some content" });
    expect(result.success).toBe(false);
  });
});

describe("searchParamsSchema", () => {
  it("accepts valid search params", () => {
    const result = searchParamsSchema.safeParse({ q: "test", page: "1", limit: "20" });
    expect(result.success).toBe(true);
  });

  it("rejects page less than 1", () => {
    const result = searchParamsSchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("coerces string numbers", () => {
    const result = searchParamsSchema.safeParse({ page: "2", limit: "50" });
    expect(result.success).toBe(true);
  });
});

describe("applyLeaveSchema", () => {
  it("accepts a valid leave application", () => {
    const result = applyLeaveSchema.safeParse({
      leave_type: "annual",
      start_date: "2026-08-10",
      end_date: "2026-08-14",
      reason: "Vacation",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid leave type", () => {
    const result = applyLeaveSchema.safeParse({
      leave_type: "paternity",
      start_date: "2026-08-10",
      end_date: "2026-08-14",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing dates", () => {
    const result = applyLeaveSchema.safeParse({ leave_type: "sick", start_date: "2026-08-10" });
    expect(result.success).toBe(false);
  });

  it("accepts reason-less application", () => {
    const result = applyLeaveSchema.safeParse({
      leave_type: "casual",
      start_date: "2026-08-10",
      end_date: "2026-08-11",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBeUndefined();
    }
  });
});

describe("decideLeaveSchema", () => {
  it("accepts approve", () => {
    const result = decideLeaveSchema.safeParse({ id: "req-1", decision: "approve" });
    expect(result.success).toBe(true);
  });

  it("accepts reject", () => {
    const result = decideLeaveSchema.safeParse({ id: "req-1", decision: "reject" });
    expect(result.success).toBe(true);
  });

  it("rejects unknown decision", () => {
    const result = decideLeaveSchema.safeParse({ id: "req-1", decision: "maybe" });
    expect(result.success).toBe(false);
  });
});

describe("validate helper", () => {
  it("returns data on success", () => {
    const result = validate(authSchema, { company_code: "ACME-1234", email: "a@b.com", password: "123456" });
    expect(result.data).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it("returns error response on failure", () => {
    const result = validate(authSchema, { email: "bad", password: "12" });
    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });
});
