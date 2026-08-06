import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import bcrypt from "bcryptjs";

const h = vi.hoisted(() => {
  const store: {
    companies: { _id: string; name: string; access_code?: string }[];
    users: { _id: string; email: string; password_hash: string; full_name: string; company_id: string; role: string }[];
    activityLogs: unknown[];
    notifications: unknown[];
  } = { companies: [], users: [], activityLogs: [], notifications: [] };
  return { store };
});

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

vi.mock("@/lib/db", () => ({ connectDB: vi.fn(async () => ({ readyState: 1 })), isMongooseConnected: vi.fn(() => false) }));

vi.mock("@/lib/models", () => {
  const models = {
    Company: {
      findById: vi.fn(),
      findOne: vi.fn(),
      updateOne: vi.fn(),
    },
    User: { findOne: vi.fn(), updateOne: vi.fn(), find: vi.fn() },
    Employee: { findOne: vi.fn() },
    Session: { create: vi.fn(), findOne: vi.fn(), deleteOne: vi.fn() },
    Invitation: { updateOne: vi.fn() },
    Department: { findById: vi.fn() },
    EmployeeTask: { find: vi.fn() },
    ActivityLog: { create: vi.fn() },
    Notification: { insertMany: vi.fn() },
  };
  return models;
});

import {
  isValidCustomAccessCode,
  normalizeAccessCode,
} from "@/lib/access-code";
import { Company, User, ActivityLog, Notification } from "@/lib/models";
import { authenticateLogin } from "@/lib/services/auth";
import {
  updateCompanyAccessCode,
  ACCESS_CODE_TAKEN_MESSAGE,
  ACCESS_CODE_INVALID_MESSAGE,
} from "@/lib/services/company";

const companyById = vi.mocked(Company.findById) as unknown as Mock;
const companyFindOne = vi.mocked(Company.findOne) as unknown as Mock;
const companyUpdateOne = vi.mocked(Company.updateOne) as unknown as Mock;
const userFindOne = vi.mocked(User.findOne) as unknown as Mock;
const userFind = vi.mocked(User.find) as unknown as Mock;
const activityCreate = vi.mocked(ActivityLog.create) as unknown as Mock;
const notifInsert = vi.mocked(Notification.insertMany) as unknown as Mock;

function seedCompanies(companies: { _id: string; name: string; access_code?: string }[]) {
  h.store.companies = companies.map((c) => ({ ...c }));
  companyFindOne.mockImplementation((filter: { access_code?: string; _id?: unknown }) => {
    if (typeof filter.access_code === "string") {
      return queryStub(
        h.store.companies.find(
          (c) =>
            c.access_code === filter.access_code &&
            !(filter._id && (filter._id as { $ne?: string }).$ne === c._id)
        ) || null
      );
    }
    return queryStub(null);
  });
  companyFindOne.mockClear();
}

function seedUsers(
  users: { _id: string; email: string; password_hash: string; full_name: string; company_id: string; role: string }[]
) {
  h.store.users = users.map((u) => ({ ...u }));
  userFindOne.mockImplementation((filter: { email?: string; company_id?: string }) =>
    queryStub(
      h.store.users.find(
        (u) =>
          u.email === (filter.email || "").toLowerCase() && u.company_id === filter.company_id
      ) || null
    )
  );
}

const queryStub = (value: unknown) => ({ lean: () => value });

const adminUser = { id: "u-admin", company_id: "c1", role: "admin", email: "admin@onboard.ai", full_name: "Ada Admin" };

beforeEach(() => {
  h.store.companies = [];
  h.store.users = [];
  h.store.activityLogs = [];
  h.store.notifications = [];
  vi.clearAllMocks();
  companyById.mockImplementation((id: string) =>
    queryStub(h.store.companies.find((c) => c._id === id) || null)
  );
  companyUpdateOne.mockImplementation((filter: { _id: string }, update: { access_code?: string }) => {
    const company = h.store.companies.find((c) => c._id === filter._id);
    if (company && update.access_code !== undefined) company.access_code = update.access_code;
    return Promise.resolve({ acknowledged: true });
  });
  activityCreate.mockImplementation((doc: unknown) => {
    h.store.activityLogs.push(doc);
    return Promise.resolve({});
  });
  notifInsert.mockImplementation((docs: unknown[]) => {
    h.store.notifications.push(...docs);
    return Promise.resolve({});
  });
  userFind.mockImplementation(() => ({
    select: () => ({
      lean: () =>
        h.store.users
          .filter((u) => u.company_id === h.store.companies[0]?._id)
          .map((u) => ({ _id: u._id })),
    }),
  }));
  userFindOne.mockImplementation(() => queryStub(null));
  (vi.mocked(User.updateOne) as unknown as Mock).mockImplementation(() => Promise.resolve({ acknowledged: true }));
});

describe("isValidCustomAccessCode", () => {
  it("accepts valid custom codes", () => {
    expect(isValidCustomAccessCode("IARE2026")).toBe(true);
    expect(isValidCustomAccessCode("IAE-HR")).toBe(true);
    expect(isValidCustomAccessCode("ONBOARDAI")).toBe(true);
    expect(isValidCustomAccessCode("ABC")).toBe(true);
    expect(isValidCustomAccessCode("A_B_C-123")).toBe(true);
    expect(isValidCustomAccessCode("X".repeat(20))).toBe(true);
  });

  it("accepts lowercase input (normalized to uppercase)", () => {
    expect(isValidCustomAccessCode("iare2026")).toBe(true);
    expect(normalizeAccessCode(" iare2026 ")).toBe("IARE2026");
  });

  it("rejects invalid custom codes", () => {
    expect(isValidCustomAccessCode("AB")).toBe(false);
    expect(isValidCustomAccessCode("X".repeat(21))).toBe(false);
    expect(isValidCustomAccessCode("MY CODE")).toBe(false);
    expect(isValidCustomAccessCode("HELLO@")).toBe(false);
    expect(isValidCustomAccessCode("CODE!")).toBe(false);
    expect(isValidCustomAccessCode("")).toBe(false);
    expect(isValidCustomAccessCode("A B-C")).toBe(false);
  });
});

describe("updateCompanyAccessCode (service)", () => {
  it("allows the admin to set a custom code (stored uppercase)", async () => {
    seedCompanies([{ _id: "c1", name: "Onboard AI", access_code: "ONBOARD-X93K" }]);
    const result = await updateCompanyAccessCode(adminUser, { code: "iare2026", ip: "203.0.113.7" });
    expect(result.access_code).toBe("IARE2026");
    expect(h.store.companies[0].access_code).toBe("IARE2026");
    expect(companyUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "c1" }),
      { access_code: "IARE2026" }
    );
  });

  it("rejects a duplicate code already used by another company", async () => {
    seedCompanies([
      { _id: "c1", name: "Onboard AI", access_code: "ONBOARD-X93K" },
      { _id: "c2", name: "Rival Corp", access_code: "IARE2026" },
    ]);
    await expect(
      updateCompanyAccessCode(adminUser, { code: "IARE2026" })
    ).rejects.toThrow(ACCESS_CODE_TAKEN_MESSAGE);
    expect(h.store.companies[0].access_code).toBe("ONBOARD-X93K");
  });

  it("allows keeping the current code (no duplicate, no-op)", async () => {
    seedCompanies([{ _id: "c1", name: "Onboard AI", access_code: "IARE2026" }]);
    const result = await updateCompanyAccessCode(adminUser, { code: "IARE2026" });
    expect(result.access_code).toBe("IARE2026");
    expect(companyUpdateOne).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("rejects invalid codes with a clear message", async () => {
    seedCompanies([{ _id: "c1", name: "Onboard AI", access_code: "ONBOARD-X93K" }]);
    for (const bad of ["AB", "MY CODE", "HELLO@", "X".repeat(21)]) {
      await expect(updateCompanyAccessCode(adminUser, { code: bad })).rejects.toThrow(
        ACCESS_CODE_INVALID_MESSAGE
      );
    }
    expect(h.store.companies[0].access_code).toBe("ONBOARD-X93K");
  });

  it("blocks hr, manager and employee from changing the code", async () => {
    seedCompanies([{ _id: "c1", name: "Onboard AI", access_code: "ONBOARD-X93K" }]);
    for (const role of ["hr", "manager", "employee"]) {
      await expect(
        updateCompanyAccessCode({ ...adminUser, role }, { code: "IARE2026" })
      ).rejects.toThrow("Insufficient permissions");
    }
    expect(h.store.companies[0].access_code).toBe("ONBOARD-X93K");
  });

  it("regenerates a random unique code when no code is provided", async () => {
    seedCompanies([{ _id: "c1", name: "Onboard AI", access_code: "ONBOARD-X93K" }]);
    const result = await updateCompanyAccessCode(adminUser, {});
    expect(result.access_code).toMatch(/^[A-Z0-9]{2,8}-[A-Z0-9]{3,6}$/);
    expect(h.store.companies[0].access_code).toBe(result.access_code);
  });

  it("logs the change (old code, new code, admin) and notifies all company users", async () => {
    seedCompanies([{ _id: "c1", name: "Onboard AI", access_code: "ONBOARD-X93K" }]);
    h.store.users = [
      { _id: "u1", email: "a@onboard.ai", password_hash: "", full_name: "Ada", company_id: "c1", role: "admin" },
      { _id: "u2", email: "e@onboard.ai", password_hash: "", full_name: "Eve", company_id: "c1", role: "employee" },
    ];
    await updateCompanyAccessCode(adminUser, { code: "IARE2026", ip: "198.51.100.9" });

    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "c1",
        action: "Company access code changed",
        details: expect.stringContaining('from "ONBOARD-X93K" to "IARE2026"'),
        ip: "198.51.100.9",
      })
    );
    expect(notifInsert).toHaveBeenCalled();
    const payload = notifInsert.mock.calls[0][0] as { user_id: string; body: string }[];
    expect(payload).toHaveLength(2);
    expect(payload[0].body).toContain("Please use the new code for future logins");
  });
});

describe("login after code change", () => {
  const passwordHash = bcrypt.hashSync("secret123", 10);

  function seed(accessCode: string) {
    seedCompanies([{ _id: "c1", name: "Onboard AI", access_code: accessCode }]);
    seedUsers([
      { _id: "u1", email: "eve@onboard.ai", password_hash: passwordHash, full_name: "Eve", company_id: "c1", role: "employee" },
    ]);
  }

  it("lets the employee log in with the NEW code", async () => {
    seed("IARE2026");
    const result = await authenticateLogin("IARE2026", "EVE@onboard.ai", "secret123");
    expect("error" in result).toBe(false);
    const user = "user" in result ? result.user : undefined;
    expect(user?.company_name).toBe("Onboard AI");
  });

  it("lets the employee log in with the new code in lowercase", async () => {
    seed("IARE2026");
    const result = await authenticateLogin("iare2026", "eve@onboard.ai", "secret123");
    expect("error" in result).toBe(false);
  });

  it("rejects login with the OLD code", async () => {
    seed("IARE2026");
    const result = await authenticateLogin("ONBOARD-X93K", "eve@onboard.ai", "secret123");
    expect(result).toEqual({ error: "Invalid company access code" });
  });

  it("preserves tenant isolation: a user cannot log in with another company's code", async () => {
    seedCompanies([
      { _id: "c1", name: "Onboard AI", access_code: "IARE2026" },
      { _id: "c2", name: "Rival Corp", access_code: "BRAND-0001" },
    ]);
    h.store.users = [
      { _id: "u1", email: "eve@onboard.ai", password_hash: passwordHash, full_name: "Eve", company_id: "c1", role: "employee" },
      { _id: "u2", email: "bob@rival.com", password_hash: passwordHash, full_name: "Bob", company_id: "c2", role: "employee" },
    ];
    userFindOne.mockImplementation((filter: { email?: string; company_id?: string }) =>
      queryStub(
        h.store.users.find(
          (u) =>
            u.email === (filter.email || "").toLowerCase() && u.company_id === filter.company_id
        ) || null
      )
    );

    // eve (only in c1) cannot log in using Rival Corp's code
    const wrong = await authenticateLogin("BRAND-0001", "eve@onboard.ai", "secret123");
    expect(wrong).toEqual({ error: "Invalid email or password" });

    // same email but the correct tenant code still works
    const right = await authenticateLogin("IARE2026", "eve@onboard.ai", "secret123");
    expect("error" in right).toBe(false);
    expect("user" in right ? right.user?.company_name : undefined).toBe("Onboard AI");

    // Rival Corp's own user logs in with Rival Corp's code
    const rival = await authenticateLogin("brand-0001", "bob@rival.com", "secret123");
    expect("error" in rival).toBe(false);
    expect("user" in rival ? rival.user?.company_name : undefined).toBe("Rival Corp");
  });

  it("blocks a non-admin user from the change endpoint even with a valid session (role guard)", async () => {
    seedCompanies([{ _id: "c1", name: "Onboard AI", access_code: "ONBOARD-X93K" }]);
    const employeeSession = { id: "u1", company_id: "c1", role: "employee", email: "eve@onboard.ai" };
    await expect(
      updateCompanyAccessCode(employeeSession, { code: "IARE2026" })
    ).rejects.toThrow("Insufficient permissions");
  });
});
