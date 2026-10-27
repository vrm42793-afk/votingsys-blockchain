-- =============================================================================
-- Migration: 20260702170000_026_security_and_schema_remediation.sql
-- Description: Phase 3.4 Security Remediation and Schema Consistency
--
-- 1. Ballot Confidentiality:
--    - Drops owner_select_all_votes policy on public.votes to prevent
--      platform owners and admins from reading individual voter-to-candidate choices.
--    - Adds get_platform_vote_stats() for platform-wide metrics without row-level leakage.
--
-- 2. Dangerous Debug Functions Removal:
--    - Drops debug_insert_org, debug_trigger_error, and find_org_id_references.
--    - Ensures no unprivileged execution grants exist.
--
-- 3. Profile Privacy:
--    - Revokes anon access to public.user_profiles.
--    - Drops "Profiles are readable by everyone" policy.
--    - Adds scoped policy for own-profile and co-member profile reads.
--    - Creates public.public_user_profiles view for safe public display fields.
--
-- 4. Candidate & Organization Authorization:
--    - Protects candidate row updates against unauthorized status escalation.
--    - Restricts organization creation to organizers and owners.
--    - Restores atomic creator-admin membership on organization insert.
--
-- 5. Missing Indexes:
--    - Adds indexes for high-frequency votes, elections, and audit log queries.
-- =============================================================================

-- =============================================================================
-- 1. BALLOT CONFIDENTIALITY
-- =============================================================================

-- Drop platform owner row-level read access to votes
DROP POLICY IF EXISTS owner_select_all_votes ON public.votes;

-- Provide aggregate platform statistics without exposing individual ballots
CREATE OR REPLACE FUNCTION public.get_platform_vote_stats()
RETURNS TABLE (
    total_votes BIGINT,
    today_votes BIGINT,
    unconfirmed_votes BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (public.get_my_platform_role() <> 'owner' AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role') THEN
        RAISE EXCEPTION 'Access denied: Platform owner authorization required';
    END IF;

    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_votes,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::BIGINT AS today_votes,
        COUNT(*) FILTER (WHERE is_chain_confirmed = FALSE)::BIGINT AS unconfirmed_votes
    FROM public.votes;
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_vote_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_vote_stats() TO authenticated;

-- =============================================================================
-- 2. REMOVE DANGEROUS DEBUG FUNCTIONS
-- =============================================================================

DROP FUNCTION IF EXISTS public.debug_insert_org(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.debug_trigger_error(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.find_org_id_references();
DROP FUNCTION IF EXISTS public.run_platform_role_security_tests();

-- =============================================================================
-- 3. PROFILE PRIVACY & RESTRICTED PUBLIC VIEW
-- =============================================================================

-- Revoke anonymous table read on user_profiles
REVOKE SELECT ON public.user_profiles FROM anon;

-- Drop unrestricted SELECT policy
DROP POLICY IF EXISTS "Profiles are readable by everyone" ON public.user_profiles;

-- Allow users to view their own profile
DROP POLICY IF EXISTS "user_profiles: users can view own profile" ON public.user_profiles;
CREATE POLICY "user_profiles: users can view own profile"
    ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Allow co-members within the same organization to view profiles
DROP POLICY IF EXISTS "user_profiles: members can view co-members" ON public.user_profiles;
CREATE POLICY "user_profiles: members can view co-members"
    ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT user_id
            FROM public.org_memberships
            WHERE organization_id IN (SELECT public.get_my_organizations())
        )
    );

-- Create restricted public profile view for safe non-sensitive public display
CREATE OR REPLACE VIEW public.public_user_profiles AS
    SELECT id, full_name, avatar_url, wallet_address, platform_role
    FROM public.user_profiles
    WHERE NOT is_suspended;

GRANT SELECT ON public.public_user_profiles TO anon, authenticated;

-- =============================================================================
-- 4. CANDIDATE & ORGANIZATION AUTHORIZATION
-- =============================================================================

-- Prevent candidate self-approval and unauthorized identifier modification
CREATE OR REPLACE FUNCTION public.protect_candidate_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (NEW.status IS DISTINCT FROM OLD.status OR
        NEW.on_chain_candidate_id IS DISTINCT FROM OLD.on_chain_candidate_id OR
        NEW.election_id IS DISTINCT FROM OLD.election_id OR
        NEW.user_id IS DISTINCT FROM OLD.user_id) THEN

        -- Allow superusers and service role
        IF (current_user IN ('postgres', 'supabase_admin') OR session_user IN ('postgres', 'supabase_admin')) THEN
            RETURN NEW;
        END IF;
        IF (COALESCE(auth.jwt() ->> 'role', '') = 'service_role') THEN
            RETURN NEW;
        END IF;

        -- Allow election admin or platform owner
        IF (public.is_election_admin(OLD.election_id) OR public.get_my_platform_role() = 'owner') THEN
            RETURN NEW;
        END IF;

        RAISE EXCEPTION 'Unauthorized: Candidates cannot modify status, election, or on-chain identifiers';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_candidate_update ON public.candidates;
CREATE TRIGGER tr_protect_candidate_update
    BEFORE UPDATE ON public.candidates
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_candidate_update();

-- Restrict organization insert policy to organizers and platform owners
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Organizers and owners can create organizations" ON public.organizations;
CREATE POLICY "Organizers and owners can create organizations"
    ON public.organizations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() IS NOT NULL AND
        public.get_my_platform_role() IN ('organizer', 'owner')
    );

-- Guard organization insertion and force owner_id to auth.uid()
CREATE OR REPLACE FUNCTION public.handle_new_organization_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (current_user IN ('postgres', 'supabase_admin') OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role') THEN
        RETURN NEW;
    END IF;

    IF public.get_my_platform_role() NOT IN ('organizer', 'owner') THEN
        RAISE EXCEPTION 'Unauthorized: Only organizers and platform owners can create organizations';
    END IF;

    NEW.owner_id := auth.uid();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_organization_insert ON public.organizations;
CREATE TRIGGER tr_guard_organization_insert
    BEFORE INSERT ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_organization_guard();

-- Auto-assign creator as admin member in public.org_memberships
CREATE OR REPLACE FUNCTION public.handle_new_organization_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.org_memberships (organization_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'admin')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_auto_organization_admin_membership ON public.organizations;
CREATE TRIGGER tr_auto_organization_admin_membership
    AFTER INSERT ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_organization_membership();

-- =============================================================================
-- 5. PERFORMANCE INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_votes_chain_tx_hash ON public.votes(chain_tx_hash);
CREATE INDEX IF NOT EXISTS idx_votes_is_chain_confirmed ON public.votes(is_chain_confirmed);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON public.votes(created_at);
CREATE INDEX IF NOT EXISTS idx_elections_status ON public.elections(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
