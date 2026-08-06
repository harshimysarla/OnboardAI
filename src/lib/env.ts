const requiredServerVars = [
  "MONGODB_URI",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "GEMINI_API_KEY",
] as const;

// Direct static access so Turbopack/Webpack can replace NEXT_PUBLIC_* at build time
const ENV: Record<string, string | undefined> = {
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_ALLOW_REGISTRATION: process.env.NEXT_PUBLIC_ALLOW_REGISTRATION,
};

function getEnv(name: string): string {
  const value = ENV[name];
  if (!value) return "";
  return value.trim();
}

export interface EnvVars {
  mongodbUri: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  geminiApiKey: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  appName: string;
  appUrl: string;
  allowRegistration: boolean;
}

let cached: EnvVars | null = null;

export function getEnvVars(): EnvVars {
  if (cached) return cached;
  cached = {
    mongodbUri: getEnv("MONGODB_URI"),
    jwtSecret: getEnv("JWT_SECRET"),
    jwtRefreshSecret: getEnv("JWT_REFRESH_SECRET"),
    geminiApiKey: getEnv("GEMINI_API_KEY"),
    cloudinaryCloudName: getEnv("CLOUDINARY_CLOUD_NAME"),
    cloudinaryApiKey: getEnv("CLOUDINARY_API_KEY"),
    cloudinaryApiSecret: getEnv("CLOUDINARY_API_SECRET"),
    appName: getEnv("NEXT_PUBLIC_APP_NAME") || "OnboardAI",
    appUrl: getEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000",
    allowRegistration: getEnv("NEXT_PUBLIC_ALLOW_REGISTRATION") === "true",
  };
  return cached;
}

export function validateEnv(): { valid: boolean; missing: string[] } {
  const vars = getEnvVars();
  const missing: string[] = [];
  for (const name of requiredServerVars) {
    if (!vars[name.replace(/^NEXT_PUBLIC_/, "").toLowerCase() as keyof EnvVars]) {
      missing.push(name);
    }
  }
  return { valid: missing.length === 0, missing };
}

export function isFullyConfigured(): boolean {
  return validateEnv().valid;
}

export function isDatabaseConfigured(): boolean {
  const vars = getEnvVars();
  return !!vars.mongodbUri;
}

export function isCloudinaryConfigured(): boolean {
  const vars = getEnvVars();
  return !!(vars.cloudinaryCloudName && vars.cloudinaryApiKey && vars.cloudinaryApiSecret);
}

export function getPublicConfig() {
  const vars = getEnvVars();
  return {
    appName: vars.appName,
    appUrl: vars.appUrl,
    allowRegistration: vars.allowRegistration,
  };
}