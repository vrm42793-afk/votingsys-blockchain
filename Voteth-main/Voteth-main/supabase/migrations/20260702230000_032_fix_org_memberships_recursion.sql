-- =============================================================================
-- Migration: 20260702230000_032_fix_org_memberships_recursion.sql
-- Description: Permanently eliminates infinite recursion in org_memberships RLS policies.
--
-- Root Cause:
-- 1. Helper functions (has_org_role, is_org_admin, get_my_organizations) were implemented
--    using LANGUAGE sql. In PostgreSQL, LANGUAGE sql functions are inlined into the caller's
--    query tree, losing their SECURITY DEFINER context and evaluating under caller RLS.
-- 2. Policies on public.org_memberships (such as "Admins can manage members" FOR ALL and
--    direct subqueries with EXISTS (SELECT 1 FROM org_memberships ...)) recursively invoked
--    the same table's SELECT policies during policy evaluation.
--
-- Solution:
-- 1. Re-implement all RLS membership helper functions in LANGUAGE plpgsql with SECURITY DEFINER
--    and fixed search_path = public, pg_temp. PL/pgSQL functions cannot be inlined by the
--    query planner, guaranteeing genuine definer execution and bypassing RLS internally.
-- 2. Drop all recursive policies on public.org_memberships.
-- 3. Establish clean, strictly partitioned policies for SELECT, INSERT, UPDATE, and DELETE.
-- 4. User self-read uses direct column comparison (user_id = auth.uid()) with zero subqueries.
-- 5. Cross-member reads, admin checks, and allowlist checks use non-inlined PL/pgSQL helpers.
-- =============================================================================

-- 1. DROP ALL OLD & RECURSIVE POLICIES ON public.org_memberships
DROP POLICY IF EXISTS "Members can see other members in their org" ON public.org_memberships;
DROP POLICY IF EXISTS "Admins can manage members" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships: members can read own rows" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships: admins can read org rows" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships: admins can insert members" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships: admins can update member roles" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships: admins can delete members" ON public.org_memberships;
DROP POLICY IF EXISTS "Members can read all memberships in their organizations" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships: voters can request membership" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships: users can read own rows" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships: admins can update members" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships: admins can delete members" ON public.org_memberships;
DROP POLICY IF EXISTS owner_select_all_memberships ON public.org_memberships;
DROP POLICY IF EXISTS owner_update_all_memberships ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_select_own" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_select_co_members" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_select_owner" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_insert_request" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_insert_admin" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_insert_owner" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_update_admin" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_update_reapply" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_update_owner" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_delete_admin" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_delete_self" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_delete_owner" ON public.org_memberships;

-- 2. RE-IMPLEMENT RLS HELPER FUNCTIONS WITH LANGUAGE plpgsql SECURITY DEFINER
-- PL/pgSQL prevents function inlining, ensuring genuine SECURITY DEFINER RLS bypass inside.

CREATE OR REPLACE FUNCTION public.has_org_role(org_uuid UUID, allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_has_role BOOLEAN;
BEGIN
    IF auth.uid() IS NULL OR org_uuid IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.org_memberships
        WHERE organization_id = org_uuid
          AND user_id = auth.uid()
          AND role = ANY(allowed_roles)
    ) INTO v_has_role;

    RETURN COALESCE(v_has_role, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(org_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL OR org_uuid IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN public.has_org_role(org_uuid, ARRAY['admin'::TEXT]);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(org_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_member BOOLEAN;
BEGIN
    IF auth.uid() IS NULL OR org_uuid IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.org_memberships
        WHERE organization_id = org_uuid
          AND user_id = auth.uid()
    ) INTO v_is_member;

    RETURN COALESCE(v_is_member, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_organizations()
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT organization_id
    FROM public.org_memberships
    WHERE user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.is_election_admin(election_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF auth.uid() IS NULL OR election_uuid IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT org_id INTO v_org_id
    FROM public.elections
    WHERE id = election_uuid;

    IF v_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN public.is_org_admin(v_org_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_election_org_member(election_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF auth.uid() IS NULL OR election_uuid IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT org_id INTO v_org_id
    FROM public.elections
    WHERE id = election_uuid;

    IF v_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN public.is_org_member(v_org_id);
END;
$$;

-- Function Execution Privileges
REVOKE ALL ON FUNCTION public.has_org_role(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_org_role(UUID, TEXT[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_org_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_org_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_my_organizations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_organizations() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_election_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_election_admin(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_election_org_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_election_org_member(UUID) TO authenticated, service_role;

-- 3. ESTABLISH CLEAN, RECURSION-FREE POLICIES ON public.org_memberships

-- 3.1 SELECT Policies
-- A. A user can always view their own memberships (direct column match, 0 subqueries)
CREATE POLICY "org_memberships_select_own"
    ON public.org_memberships
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- B. Members of an organization can view fellow members (via non-inlined PL/pgSQL helper)
CREATE POLICY "org_memberships_select_co_members"
    ON public.org_memberships
    FOR SELECT
    TO authenticated
    USING (public.is_org_member(organization_id));

-- C. Platform owner can view all memberships
CREATE POLICY "org_memberships_select_owner"
    ON public.org_memberships
    FOR SELECT
    TO authenticated
    USING (public.get_my_platform_role() = 'owner');

-- 3.2 INSERT Policies
-- A. Any authenticated voter can request membership as viewer (role restricted to viewer)
CREATE POLICY "org_memberships_insert_request"
    ON public.org_memberships
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND role = 'viewer'
    );

-- B. Organization admin can add members to their organization
CREATE POLICY "org_memberships_insert_admin"
    ON public.org_memberships
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_org_admin(organization_id)
    );

-- C. Platform owner can insert any membership
CREATE POLICY "org_memberships_insert_owner"
    ON public.org_memberships
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.get_my_platform_role() = 'owner'
    );

-- 3.3 UPDATE Policies
-- A. Organization admin can update members in their organization
CREATE POLICY "org_memberships_update_admin"
    ON public.org_memberships
    FOR UPDATE
    TO authenticated
    USING (
        public.is_org_admin(organization_id)
    )
    WITH CHECK (
        public.is_org_admin(organization_id)
    );

-- B. Voters can re-apply if their previous request was rejected
CREATE POLICY "org_memberships_update_reapply"
    ON public.org_memberships
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
    )
    WITH CHECK (
        user_id = auth.uid()
        AND role = 'viewer'
    );

-- C. Platform owner can update any membership
CREATE POLICY "org_memberships_update_owner"
    ON public.org_memberships
    FOR UPDATE
    TO authenticated
    USING (
        public.get_my_platform_role() = 'owner'
    );

-- 3.4 DELETE Policies
-- A. Organization admin can remove members from their organization
CREATE POLICY "org_memberships_delete_admin"
    ON public.org_memberships
    FOR DELETE
    TO authenticated
    USING (
        public.is_org_admin(organization_id)
    );

-- B. Users can leave an organization or cancel their pending request
CREATE POLICY "org_memberships_delete_self"
    ON public.org_memberships
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
    );

-- C. Platform owner can delete any membership
CREATE POLICY "org_memberships_delete_owner"
    ON public.org_memberships
    FOR DELETE
    TO authenticated
    USING (
        public.get_my_platform_role() = 'owner'
    );

-- 4. UPDATE ELECTIONS POLICY TO USE NON-RECURSIVE HELPER
DROP POLICY IF EXISTS "Voters and members can view available elections" ON public.elections;
CREATE POLICY "Voters and members can view available elections"
  ON public.elections
  FOR SELECT
  TO authenticated
  USING (
    status IN ('open', 'published', 'closed') OR
    EXISTS (
      SELECT 1 FROM public.election_voters AS ev
      WHERE ev.election_id = elections.id
        AND ev.user_id = auth.uid()
    ) OR
    public.is_org_member(elections.org_id) OR
    public.get_my_platform_role() = 'owner'
  );
