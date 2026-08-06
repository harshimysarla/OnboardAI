import crypto from "crypto";

// Excludes easily-confused characters: 0/O, 1/I/L
const SUFFIX_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const ACCESS_CODE_REGEX = /^[A-Z0-9]{2,8}-[A-Z0-9]{3,6}$/i;

// User-customizable access codes: 3–20 chars of letters, numbers, hyphen, underscore.
export const CUSTOM_ACCESS_CODE_REGEX = /^[A-Z0-9_-]{3,20}$/;

export function normalizeAccessCode(code: string): string {
  return (code ?? "").trim().toUpperCase();
}

export function isValidAccessCode(code: string): boolean {
  return ACCESS_CODE_REGEX.test(normalizeAccessCode(code));
}

export function isValidCustomAccessCode(code: string): boolean {
  return CUSTOM_ACCESS_CODE_REGEX.test(normalizeAccessCode(code));
}

function randomSuffix(length: number = 4): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SUFFIX_CHARS[bytes[i] % SUFFIX_CHARS.length];
  }
  return out;
}

/**
 * Builds a human-friendly company access code like "MICRO-6X91".
 * Prefix comes from the company name (first 5 alphanumeric chars),
 * suffix is 4 random unambiguous characters.
 */
export function buildAccessCode(companyName: string): string {
  const clean = companyName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const prefix = (clean || "COMP").padEnd(2, "X").slice(0, 5);
  return `${prefix}-${randomSuffix()}`;
}

/**
 * Generates a unique access code for a company. `isTaken` should check
 * the database for existing codes; returns a fresh code up to 5 tries.
 */
export async function generateUniqueAccessCode(
  companyName: string,
  isTaken: (code: string) => Promise<boolean>
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = buildAccessCode(companyName);
    if (!(await isTaken(code))) {
      return code;
    }
  }
  return `COMP-${randomSuffix(6)}`;
}