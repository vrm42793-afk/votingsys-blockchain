-- 009_fix_rls_recursion.sql
-- Fixes infinite recursion in org_memberships caused by self-referencing EXISTS policies

-- 1. Drop all recursive policies on org_memberships
DROP POLICY IF EXISTS "Members can see other members in their org" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships: admins can read org rows" ON public.org_memberships;

-- 2. Create a SECURITY DEFINER function to fetch the user's organization UUIDs safely
-- SECURITY DEFINER bypasses RLS, so querying org_memberships inside it won't loop.
CREATE OR REPLACE FUNCTION public.get_my_organizations()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organization_id FROM org_memberships WHERE user_id = auth.uid();
$$;

-- 3. Replace the recursive SELECT policies with a single, safe policy
CREATE POLICY "Members can read all memberships in their organizations"
  ON public.org_memberships
  FOR SELECT
  USING (
    organization_id IN (SELECT public.get_my_organizations())
  );
