import { createServerClient as createSSRClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getEnvVars, isSupabaseConfigured as checkConfigured } from "./env";

const vars = getEnvVars();

export const hasCredentials = checkConfigured();

export const createServerClient = async () => {
  if (!hasCredentials) return null;
  const cookieStore = await cookies();
  return createSSRClient(vars.supabaseUrl, vars.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });
};

const _supabaseAdmin = hasCredentials && vars.serviceRoleKey
  ? createClient(vars.supabaseUrl, vars.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export { _supabaseAdmin as supabaseAdmin };
