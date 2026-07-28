import { createClient } from "@supabase/supabase-js";
import { getPublicConfig, isSupabaseConfigured as checkConfigured } from "./env";

const config = getPublicConfig();

export const isSupabaseConfigured = checkConfigured();

function createAnonClient() {
  if (!checkConfigured()) return null;
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
}

const _client = createAnonClient();

export { _client as supabase };

export function createBrowserClient() {
  return createAnonClient();
}
