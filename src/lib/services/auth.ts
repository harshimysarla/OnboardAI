import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getEnvVars } from "@/lib/env";
import { connectDB } from "@/lib/db";
import { User, Company, Employee, Session, Invitation } from "@/lib/models";
import { normalizeAccessCode, generateUniqueAccessCode } from "@/lib/access-code";
import { rewardPolicySigned } from "./gamification";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export interface AuthenticatedUser {
  id: string;
  email: string;
  full_name: string;
  company_id: string;
  company_name: string;
  role: "admin" | "hr" | "manager" | "employee";
  employee_id?: string;
  avatar_url?: string;
  phone?: string;
  language?: string;
  timezone?: string;
  profile_completed?: boolean;
  must_change_password?: boolean;
}

export const ACCESS_TOKEN_COOKIE = "onboardai_token";
export const REFRESH_TOKEN_COOKIE = "onboardai_refresh";

const ACCESS_MAX_AGE = 60 * 60; // 1 hour
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(key: string): Uint8Array {
  return new TextEncoder().encode(key);
}

function getSecrets() {
  const vars = getEnvVars();
  if (!vars.jwtSecret || !vars.jwtRefreshSecret) {
    throw new Error("JWT secrets are not configured");
  }
  return { access: vars.jwtSecret, refresh: vars.jwtRefreshSecret };
}

export async function signAccessToken(payload: {
  userId: string;
  role: string;
  companyId: string;
}): Promise<string> {
  return new SignJWT({ role: payload.role, companyId: payload.companyId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret(getSecrets().access));
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret(getSecrets().refresh));
}

export async function verifyAccessToken(
  token: string
): Promise<{ userId: string; role: string; companyId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(getSecrets().access));
    return {
      userId: payload.sub || "",
      role: (payload.role as string) || "employee",
      companyId: (payload.companyId as string) || "",
    };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(getSecrets().refresh));
    return { userId: payload.sub || "" };
  } catch {
    return null;
  }
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createSession(userId: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const refreshToken = await signRefreshToken(userId);
  const expiresAt = new Date(Date.now() + REFRESH_MAX_AGE * 1000);
  await Session.create({
    user_id: userId,
    refresh_token_hash: hashToken(refreshToken),
    expires_at: expiresAt,
  });
  return refreshToken;
}

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });
  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_MAX_AGE,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_TOKEN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  cookieStore.set(REFRESH_TOKEN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const conn = await connectDB();
  if (!conn) return null;

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return null;

  const verified = await verifyAccessToken(accessToken);
  if (!verified) return null;

  const user = await User.findById(verified.userId).lean();
  if (!user) return null;

  const company = await Company.findById(user.company_id).lean();
  if (!company) return null;

  const employee = await Employee.findOne({ user_id: user._id })
    .select("_id")
    .lean();

  return {
    id: user._id.toString(),
    email: user.email,
    full_name: user.full_name,
    company_id: user.company_id.toString(),
    company_name: company.name,
    role: user.role,
    employee_id: employee ? employee._id.toString() : undefined,
    avatar_url: user.avatar_url || "",
    phone: user.phone || "",
    language: user.language || "en",
    timezone: user.timezone || "",
    profile_completed: !!user.profile_completed,
    must_change_password: !!user.must_change_password,
  };
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Authentication required");
  return user;
}

export async function requireRole(...roles: string[]): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) throw new Error("Insufficient permissions");
  return user;
}

/**
 * Core tenant-scoped authentication. Validates the company access code,
 * finds the company, then looks up the user ONLY within that company —
 * guaranteeing tenant isolation even if another company has the same email.
 * Does not touch cookies so it is unit-testable.
 */
export async function authenticateLogin(companyCode: string, email: string, password: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const normalizedCode = normalizeAccessCode(companyCode);
  let company = await Company.findOne({ access_code: normalizedCode }).lean();
  if (!company) {
    return { error: "Invalid company access code" };
  }

  // Lazy backfill for companies created before access codes existed.
  if (!company.access_code) {
    const code = await generateUniqueAccessCode(
      company.name,
      async (c) => !!(await Company.findOne({ access_code: c }).lean())
    );
    await Company.updateOne({ _id: company._id }, { access_code: code });
    company = { ...company, access_code: code };
  }

  // Search the user ONLY inside the matched company (tenant isolation).
  const user = await User.findOne({
    email: email.toLowerCase(),
    company_id: company._id,
  }).lean();
  if (!user) return { error: "Invalid email or password" };

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) return { error: "Invalid email or password" };

  await User.updateOne({ _id: user._id }, { last_login_at: new Date() }).catch(() => {});

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      full_name: user.full_name,
      company_id: user.company_id.toString(),
      company_name: company.name,
      role: user.role,
    },
  };
}

export async function loginUser(companyCode: string, email: string, password: string) {
  const result = await authenticateLogin(companyCode, email, password);
  if ("error" in result) return result;

  const { id, role, company_id, company_name } = result.user;

  const accessToken = await signAccessToken({
    userId: id,
    role,
    companyId: company_id,
  });
  const refreshToken = await createSession(id);

  await setAuthCookies(accessToken, refreshToken);

  return {
    user: {
      id,
      email: result.user.email,
      full_name: result.user.full_name,
      company_id,
      company_name,
      role,
    },
  };
}

export async function logoutUser() {
  const conn = await connectDB();
  if (!conn) return;

  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    await Session.deleteOne({ refresh_token_hash: hashToken(refreshToken) }).catch(() => {});
  }
  await clearAuthCookies();
}

export async function rotateRefreshToken(refreshToken: string) {
  const conn = await connectDB();
  if (!conn) return null;

  const session = await Session.findOne({
    refresh_token_hash: hashToken(refreshToken),
  });
  if (!session) return null;

  const verified = await verifyRefreshToken(refreshToken);
  if (!verified) return null;

  const user = await User.findById(verified.userId).lean();
  if (!user) return null;

  await Session.deleteOne({ _id: session._id });

  const accessToken = await signAccessToken({
    userId: user._id.toString(),
    role: user.role,
    companyId: user.company_id.toString(),
  });
  const newRefreshToken = await createSession(user._id.toString());

  await setAuthCookies(accessToken, newRefreshToken);

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      full_name: user.full_name,
      company_id: user.company_id.toString(),
      role: user.role,
    },
  };
}

export async function changePassword(userId: string, newPassword: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const password_hash = await hashPassword(newPassword);
  await User.updateOne(
    { _id: userId },
    { password_hash, must_change_password: false }
  );

  await Invitation.updateOne(
    { user_id: userId, status: "pending" },
    { status: "accepted" }
  ).catch(() => {});
}

export async function updateProfile(
  userId: string,
  fields: { phone?: string; language?: string; timezone?: string }
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const update: Record<string, unknown> = {};
  if (fields.phone !== undefined) update.phone = fields.phone;
  if (fields.language !== undefined) update.language = fields.language;
  if (fields.timezone !== undefined) update.timezone = fields.timezone;

  if (Object.keys(update).length) {
    await User.updateOne({ _id: userId }, update);
  }
}

export async function completeProfile(userId: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  await User.updateOne({ _id: userId }, { profile_completed: true });
}

export async function acceptPolicies(userId: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  await User.updateOne({ _id: userId }, { has_accepted_policies_at: new Date() });

  await Invitation.updateOne(
    { user_id: userId, status: "accepted" },
    { status: "completed" }
  ).catch(() => {});

  await rewardPolicySigned(userId);
}

export async function registerUser(params: {
  full_name: string;
  email: string;
  password: string;
  company_name: string;
}) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  if (!getEnvVars().allowRegistration) {
    throw new Error("Registration is disabled");
  }

  const existing = await User.findOne({ email: params.email.toLowerCase() }).lean();
  if (existing) throw new Error("An account with this email already exists");

  const slugBase = params.company_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  let slug = slugBase || `company-${Date.now()}`;
  let suffix = 2;
  while (await Company.findOne({ slug })) {
    slug = `${slugBase}-${suffix++}`;
  }

  const accessCode = await generateUniqueAccessCode(
    params.company_name,
    async (code) => !!(await Company.findOne({ access_code: code }).lean())
  );

  const company = await Company.create({
    name: params.company_name,
    slug,
    access_code: accessCode,
  });

  const user = await User.create({
    email: params.email.toLowerCase(),
    password_hash: await hashPassword(params.password),
    full_name: params.full_name,
    role: "admin",
    company_id: company._id,
  });

  const accessToken = await signAccessToken({
    userId: user._id.toString(),
    role: user.role,
    companyId: company._id.toString(),
  });
  const refreshToken = await createSession(user._id.toString());

  await setAuthCookies(accessToken, refreshToken);

  return {
    user: { id: user._id.toString(), email: user.email, full_name: user.full_name },
    access_code: accessCode,
  };
}