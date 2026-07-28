const requiredServerVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GEMINI_API_KEY",
] as const;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) return "";
  return value.trim();
}

export interface EnvVars {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey: string;
  geminiApiKey: string;
  appName: string;
  appUrl: string;
}

let cached: EnvVars | null = null;

export function getEnvVars(): EnvVars {
  if (cached) return cached;
  cached = {
    supabaseUrl: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    geminiApiKey: getEnv("GEMINI_API_KEY"),
    appName: getEnv("NEXT_PUBLIC_APP_NAME") || "OnboardAI",
    appUrl: getEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000",
  };
  return cached;
}

export function validateEnv(): { valid: boolean; missing: string[] } {
  const vars = getEnvVars();
  const missing: string[] = [];
  const map: Record<string, keyof EnvVars> = {
    NEXT_PUBLIC_SUPABASE_URL: "supabaseUrl",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "supabaseAnonKey",
    SUPABASE_SERVICE_ROLE_KEY: "serviceRoleKey",
    GEMINI_API_KEY: "geminiApiKey",
  };
  for (const name of requiredServerVars) {
    if (!vars[map[name]]) {
      missing.push(name);
    }
  }
  if (vars.supabaseUrl && vars.supabaseUrl.includes("/rest/v1")) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL must be the base project URL only (no /rest/v1)");
  }
  if (vars.serviceRoleKey && !vars.serviceRoleKey.startsWith("eyJ")) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY should be a service role JWT (starts with 'eyJ'), not a URL or other value");
  }
  return { valid: missing.length === 0, missing };
}

export function isFullyConfigured(): boolean {
  return validateEnv().valid;
}

export function isSupabaseConfigured(): boolean {
  const vars = getEnvVars();
  return !!(vars.supabaseUrl && vars.supabaseAnonKey);
}

export function getPublicConfig() {
  const vars = getEnvVars();
  return {
    supabaseUrl: vars.supabaseUrl,
    supabaseAnonKey: vars.supabaseAnonKey,
    appName: vars.appName,
    appUrl: vars.appUrl,
  };
}

// Startup validation — runs once on module import
if (typeof process !== "undefined" && process.env) {
  const { valid, missing } = validateEnv();
  if (!valid) {
    console.warn("[env] Configuration issues detected:");
    missing.forEach(m => console.warn("  ⚠ " + m));
  }
}
