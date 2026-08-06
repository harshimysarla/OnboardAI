-- Fix infinite RLS recursion ("stack depth limit exceeded")
-- Root cause: get_user_company_id() / get_user_role() read from profiles,
-- which has RLS enabled. Without SECURITY DEFINER, those reads re-enter RLS
-- policy evaluation, which calls the same function again -> infinite recursion.
--
-- Result in app: every profiles/companies query 500s -> /api/auth returns
-- {"user":null} -> AppLayout redirects to /login while the proxy (valid
-- session) redirects back to /dashboard -> infinite loading on both pages.
--
-- Run this in the Supabase SQL editor (or via supabase db execute).

-- Fix 1: SECURITY DEFINER on RLS helper functions (bypass RLS when reading profiles)
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Fix 2: Allow users to view their own profile (belt-and-braces; also used
-- when a user has not yet been linked to a company)
DROP POLICY IF EXISTS "users can view their own profile" ON profiles;
CREATE POLICY "users can view their own profile"
  ON profiles FOR SELECT USING (
    id = auth.uid()
  );
