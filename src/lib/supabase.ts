import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasCredentials = !!supabaseUrl && !!supabaseAnonKey;

export const supabase = hasCredentials
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export const supabaseAdmin = hasCredentials && serviceRoleKey
  ? createClient(supabaseUrl!, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// Client-side: creates a browser-based supabase client
export const createBrowserClient = () => {
  if (!hasCredentials) return null;
  return createClient(supabaseUrl!, supabaseAnonKey!);
};

export const isSupabaseConfigured = hasCredentials;
