-- 019_fix_rls_recursion.sql
-- Resolves the "infinite recursion detected in policy for relation user_profiles" error.
-- Creates a SECURITY DEFINER helper function to safely fetch the platform role without triggering RLS checks recursively.

-- 1. Drop the old recursive policies
DROP POLICY IF EXISTS owner_select_all_profiles ON public.user_profiles;
DROP POLICY IF EXISTS owner_update_all_profiles ON public.user_profiles;
DROP POLICY IF EXISTS owner_select_all_orgs ON public.organizations;
DROP POLICY IF EXISTS owner_update_all_orgs ON public.organizations;
DROP POLICY IF EXISTS owner_delete_all_orgs ON public.organizations;
DROP POLICY IF EXISTS owner_select_all_memberships ON public.org_memberships;
DROP POLICY IF EXISTS owner_update_all_memberships ON public.org_memberships;
DROP POLICY IF EXISTS owner_select_all_elections ON public.elections;
DROP POLICY IF EXISTS owner_select_all_votes ON public.votes;
DROP POLICY IF EXISTS owner_select_all_audit_logs ON public.audit_logs;
DROP POLICY IF EXISTS owner_insert_all_audit_logs ON public.audit_logs;

-- 2. Create the SECURITY DEFINER helper function (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_platform_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT platform_role INTO v_role FROM public.user_profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'voter');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the policies using the helper function
CREATE POLICY owner_select_all_profiles ON public.user_profiles
    FOR SELECT TO authenticated
    USING (public.get_my_platform_role() = 'owner');

CREATE POLICY owner_update_all_profiles ON public.user_profiles
    FOR UPDATE TO authenticated
    USING (public.get_my_platform_role() = 'owner');

CREATE POLICY owner_select_all_orgs ON public.organizations
    FOR SELECT TO authenticated
    USING (public.get_my_platform_role() = 'owner');

CREATE POLICY owner_update_all_orgs ON public.organizations
    FOR UPDATE TO authenticated
    USING (public.get_my_platform_role() = 'owner');

CREATE POLICY owner_delete_all_orgs ON public.organizations
    FOR DELETE TO authenticated
    USING (public.get_my_platform_role() = 'owner');

CREATE POLICY owner_select_all_memberships ON public.org_memberships
    FOR SELECT TO authenticated
    USING (public.get_my_platform_role() = 'owner');

CREATE POLICY owner_update_all_memberships ON public.org_memberships
    FOR UPDATE TO authenticated
    USING (public.get_my_platform_role() = 'owner');

CREATE POLICY owner_select_all_elections ON public.elections
    FOR SELECT TO authenticated
    USING (public.get_my_platform_role() = 'owner');

CREATE POLICY owner_select_all_votes ON public.votes
    FOR SELECT TO authenticated
    USING (public.get_my_platform_role() = 'owner');

CREATE POLICY owner_select_all_audit_logs ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.get_my_platform_role() = 'owner');

CREATE POLICY owner_insert_all_audit_logs ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.get_my_platform_role() = 'owner');
