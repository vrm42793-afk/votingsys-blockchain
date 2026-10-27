-- =============================================================================
-- Migration: 20260702232000_034_sync_voter_requests_and_allowlist.sql
-- Description: Complete synchronization for voter requests, approvals, and election allowlists.
--
-- Features:
-- 1. Adds status ('pending', 'approved', 'rejected') and timestamps to public.election_voters.
-- 2. Establishes non-recursive, partitioned RLS policies on public.election_voters:
--    - Voters can read their own allowlist/request rows.
--    - Voters can insert pending participation requests for themselves.
--    - Election admins can view, approve, reject, or remove allowlist entries for their elections.
--    - Platform owners maintain oversight.
-- 3. Confirms PL/pgSQL SECURITY DEFINER helpers for is_election_admin and is_org_admin.
-- =============================================================================

-- 1. Ensure public.org_memberships has status and timestamps
ALTER TABLE public.org_memberships 
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved' 
    CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.org_memberships 
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.org_memberships 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_org_memberships_status 
    ON public.org_memberships(organization_id, status);

-- 2. Add status and timestamps to public.election_voters
ALTER TABLE public.election_voters 
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved' 
    CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.election_voters 
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.election_voters 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_election_voters_status 
    ON public.election_voters(election_id, status);

CREATE INDEX IF NOT EXISTS idx_election_voters_user_lookup 
    ON public.election_voters(user_id, status);

-- 3. Enable RLS on election_voters
ALTER TABLE public.election_voters ENABLE ROW LEVEL SECURITY;

-- 4. Drop legacy or conflicting policies on election_voters
DROP POLICY IF EXISTS "Org members can view allowlist" ON public.election_voters;
DROP POLICY IF EXISTS "Voters and members can view allowlist" ON public.election_voters;
DROP POLICY IF EXISTS "Admins can manage allowlist" ON public.election_voters;
DROP POLICY IF EXISTS "election_voters_select" ON public.election_voters;
DROP POLICY IF EXISTS "election_voters_insert_voter_request" ON public.election_voters;
DROP POLICY IF EXISTS "election_voters_insert_admin" ON public.election_voters;
DROP POLICY IF EXISTS "election_voters_update_admin" ON public.election_voters;
DROP POLICY IF EXISTS "election_voters_delete_admin" ON public.election_voters;
DROP POLICY IF EXISTS "election_voters_delete_self" ON public.election_voters;

-- 5. Partitioned RLS Policies on public.election_voters

-- A. SELECT: Voters can view their own allowlist row; Election admins and Platform owners can view all rows for their elections
CREATE POLICY "election_voters_select"
    ON public.election_voters
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        public.is_election_admin(election_id) OR
        public.get_my_platform_role() = 'owner'
    );

-- B. INSERT (Voter Request): A voter can submit a pending participation request for themselves
CREATE POLICY "election_voters_insert_voter_request"
    ON public.election_voters
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND
        status = 'pending'
    );

-- C. INSERT (Admin): An election admin or owner can add voters directly
CREATE POLICY "election_voters_insert_admin"
    ON public.election_voters
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_election_admin(election_id) OR
        public.get_my_platform_role() = 'owner'
    );

-- D. UPDATE (Admin Approval/Rejection): Only election admins or owners can update allowlist status
CREATE POLICY "election_voters_update_admin"
    ON public.election_voters
    FOR UPDATE
    TO authenticated
    USING (
        public.is_election_admin(election_id) OR
        public.get_my_platform_role() = 'owner'
    )
    WITH CHECK (
        public.is_election_admin(election_id) OR
        public.get_my_platform_role() = 'owner'
    );

-- E. DELETE: Admins can remove voters; Voters can withdraw their own pending request
CREATE POLICY "election_voters_delete"
    ON public.election_voters
    FOR DELETE
    TO authenticated
    USING (
        (user_id = auth.uid() AND status = 'pending') OR
        public.is_election_admin(election_id) OR
        public.get_my_platform_role() = 'owner'
    );

-- 6. Helper function to check if voter is allowlisted or approved for an election
CREATE OR REPLACE FUNCTION public.check_voter_election_eligibility(p_election_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_allowlisted BOOLEAN := FALSE;
    v_is_org_approved BOOLEAN := FALSE;
    v_eligibility_mode TEXT;
    v_org_id UUID;
BEGIN
    -- Check election settings
    SELECT org_id, is_active_eligibility 
    INTO v_org_id, v_eligibility_mode
    FROM public.elections 
    WHERE id = p_election_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 1. Check explicit election_voters allowlist
    SELECT EXISTS (
        SELECT 1 FROM public.election_voters
        WHERE election_id = p_election_id
          AND user_id = p_user_id
          AND (status IS NULL OR status = 'approved')
    ) INTO v_is_allowlisted;

    IF v_is_allowlisted THEN
        RETURN TRUE;
    END IF;

    -- 2. If entire_org, check org_memberships
    IF v_eligibility_mode IS NULL OR v_eligibility_mode = 'entire_org' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.org_memberships
            WHERE organization_id = v_org_id
              AND user_id = p_user_id
              AND (status IS NULL OR status = 'approved')
        ) INTO v_is_org_approved;

        RETURN v_is_org_approved;
    END IF;

    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.check_voter_election_eligibility IS 
'Security definer function to evaluate voter eligibility without recursive RLS evaluation.';
