import { describe, it, expect } from "vitest";
import {
  normalizeAccessCode,
  isValidAccessCode,
  buildAccessCode,
  generateUniqueAccessCode,
  ACCESS_CODE_REGEX,
} from "@/lib/access-code";

describe("normalizeAccessCode", () => {
  it("trims and uppercases", () => {
    expect(normalizeAccessCode("  micro-6x91  ")).toBe("MICRO-6X91");
  });

  it("handles empty input", () => {
    expect(normalizeAccessCode("")).toBe("");
    expect(normalizeAccessCode(null as unknown as string)).toBe("");
    expect(normalizeAccessCode(undefined as unknown as string)).toBe("");
  });
});

describe("isValidAccessCode", () => {
  it("accepts valid codes", () => {
    expect(isValidAccessCode("MICRO-6X91")).toBe(true);
    expect(isValidAccessCode("ACME-2K7Z")).toBe(true);
  });

  it("rejects malformed codes", () => {
    expect(isValidAccessCode("")).toBe(false);
    expect(isValidAccessCode("TOOLONGCODE-XYZ")).toBe(false);
    expect(isValidAccessCode("NODASH")).toBe(false);
    expect(isValidAccessCode("ABCDE-1")).toBe(false);
    expect(isValidAccessCode("AB-12")).toBe(false);
    expect(isValidAccessCode("!!!-AAA")).toBe(false);
  });
});

describe("buildAccessCode", () => {
  it("builds prefix from company name (5 chars, alphanumeric)", () => {
    const code = buildAccessCode("Microsoft");
    expect(code).toMatch(ACCESS_CODE_REGEX);
    expect(code.startsWith("MICRO-")).toBe(true);
  });

  it("handles short names", () => {
    const code = buildAccessCode("A");
    expect(code).toMatch(ACCESS_CODE_REGEX);
  });

  it("strips non-alphanumeric characters", () => {
    const code = buildAccessCode("Acme-Corp LLC");
    expect(code.startsWith("ACMEC-")).toBe(true);
  });

  it("produces unique codes", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      seen.add(buildAccessCode("Same Company"));
    }
    expect(seen.size).toBeGreaterThan(90);
  });

  it("suffix uses only unambiguous characters", () => {
    const suffixChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = buildAccessCode("Unambiguous");
    const suffix = code.split("-")[1];
    for (const ch of suffix) {
      expect(suffixChars).toContain(ch);
    }
  });
});

describe("generateUniqueAccessCode", () => {
  it("returns a code not claimed by the uniqueness check", async () => {
    const code = await generateUniqueAccessCode("Unique Corp", async (c) => c === "UNIQU-0001");
    expect(code).toBeDefined();
    expect(isValidAccessCode(code)).toBe(true);
  });

  it("falls back after exhausting attempts", async () => {
    const code = await generateUniqueAccessCode("Fallback Co", async () => true);
    expect(code.startsWith("COMP-")).toBe(true);
    expect(code.length).toBe("COMP-".length + 6);
    expect(ACCESS_CODE_REGEX.test(code)).toBe(true);
  });
});
