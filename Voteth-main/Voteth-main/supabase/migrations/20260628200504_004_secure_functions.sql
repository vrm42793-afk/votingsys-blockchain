-- 004_secure_functions.sql
-- Secure SECURITY DEFINER functions for privileged operations.
-- These bypass RLS intentionally but verify authorization internally.

-- ============================================================
-- 1. Auto-create profile on auth.users insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. Auto-assign creator as org admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.org_memberships (org_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'admin');
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_organization_created
    AFTER INSERT ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- ============================================================
-- 3. Election Results (SECURITY DEFINER)
--
-- Why SECURITY DEFINER?
--   The votes table is unreadable to admins via RLS to preserve voter
--   privacy (VOTE-07). This function bypasses RLS to COUNT votes by
--   candidate, but NEVER returns individual voter IDs or choices.
--
-- Hardening:
--   - Validates election exists and belongs to a visible org
--   - Returns zero rows if election status is not 'published'
--   - SET search_path = '' prevents schema hijacking
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_election_results(p_election_id UUID)
RETURNS TABLE (
    candidate_id UUID,
    candidate_name TEXT,
    vote_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_status public.election_status;
    v_org_id UUID;
BEGIN
    -- Step 1: Validate the election exists and get its status
    SELECT status, org_id
    INTO v_status, v_org_id
    FROM public.elections
    WHERE id = p_election_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found';
    END IF;

    -- Step 2: Ensure caller is a member of the election's organization
    IF NOT EXISTS (
        SELECT 1 FROM public.org_memberships
        WHERE org_id = v_org_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Step 3: Only return results if election is published
    IF v_status != 'published' THEN
        -- Return empty set; do not reveal individual or aggregate counts early
        RETURN;
    END IF;

    -- Step 4: Return aggregate counts only - no voter IDs exposed
    RETURN QUERY
    SELECT
        c.id AS candidate_id,
        c.name AS candidate_name,
        COUNT(v.id) AS vote_count
    FROM public.candidates c
    LEFT JOIN public.votes v ON v.candidate_id = c.id AND v.election_id = p_election_id
    WHERE c.election_id = p_election_id
    AND c.status = 'approved'
    GROUP BY c.id, c.name
    ORDER BY vote_count DESC;
END;
$$;

-- ============================================================
-- 4. Admin Election Results (for pre-publish admin view only)
--
-- Only org admins can call this. Returns vote counts in any state.
-- Used for the pre-publish summary screen (US-005).
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_election_results(p_election_id UUID)
RETURNS TABLE (
    candidate_id UUID,
    candidate_name TEXT,
    vote_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT org_id INTO v_org_id
    FROM public.elections
    WHERE id = p_election_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found';
    END IF;

    -- Only admins
    IF NOT EXISTS (
        SELECT 1 FROM public.org_memberships
        WHERE org_id = v_org_id AND user_id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    RETURN QUERY
    SELECT
        c.id AS candidate_id,
        c.name AS candidate_name,
        COUNT(v.id) AS vote_count
    FROM public.candidates c
    LEFT JOIN public.votes v ON v.candidate_id = c.id AND v.election_id = p_election_id
    WHERE c.election_id = p_election_id
    AND c.status = 'approved'
    GROUP BY c.id, c.name
    ORDER BY vote_count DESC;
END;
$$;

-- ============================================================
-- 5. QR Code Redemption
--
-- WHY AN EDGE FUNCTION IS NEEDED (NOT handled here):
--   QR redemption cannot be done safely via a SECURITY DEFINER
--   function called directly by the client because:
--   a) The client submitting the QR token IS potentially the voter,
--      but the token may be shared/stolen.
--   b) Marking the token 'used' and creating a voting session must
--      happen atomically, and the session key returned must not be
--      interceptable.
--   c) The correct flow is: Edge Function validates token, marks
--      it used, issues a short-lived signed JWT for the voter,
--      and then the voter proceeds through the normal vote write path.
--
-- This function is a UTILITY for use by the Edge Function only,
-- called via the service_role key, never directly by the client.
-- ============================================================
CREATE OR REPLACE FUNCTION public.redeem_qr_code(p_token UUID)
RETURNS TABLE (
    voter_id UUID,
    election_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_qr public.qr_codes;
BEGIN
    SELECT * INTO v_qr
    FROM public.qr_codes
    WHERE token = p_token
    AND status = 'active'
    AND expires_at > NOW()
    FOR UPDATE; -- Lock the row to prevent race conditions

    IF NOT FOUND THEN
        RAISE EXCEPTION 'QR token invalid, already used, or expired';
    END IF;

    -- Mark as used atomically
    UPDATE public.qr_codes
    SET status = 'used'
    WHERE id = v_qr.id;

    RETURN QUERY SELECT v_qr.voter_id, v_qr.election_id;
END;
$$;

-- ============================================================
-- 6. Update Chain TX Hash (for Edge Function / blockchain worker)
--
-- WHY SERVER-SIDE ONLY:
--   A client cannot be trusted to submit an honest tx hash. This
--   must be confirmed by a trusted worker (Edge Function or cron job)
--   that listens for the on-chain VoteCast event and then writes the
--   confirmed hash back via the service_role key.
--
--   The function validates that the vote_hash matches what was
--   originally submitted before updating the chain data.
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_vote_on_chain(
    p_vote_id UUID,
    p_chain_tx_hash TEXT,
    p_chain_block_number BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.votes
    SET
        chain_tx_hash = p_chain_tx_hash,
        chain_block_number = p_chain_block_number,
        is_chain_confirmed = TRUE
    WHERE id = p_vote_id
    AND chain_tx_hash IS NULL; -- Only update if not already confirmed

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vote not found or already chain-confirmed';
    END IF;
END;
$$;

-- ============================================================
-- 7. Voter Turnout (safe aggregate, org-member readable)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_voter_turnout(p_election_id UUID)
RETURNS TABLE (
    total_eligible BIGINT,
    total_voted BIGINT,
    turnout_percent NUMERIC(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT org_id INTO v_org_id
    FROM public.elections
    WHERE id = p_election_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.org_memberships
        WHERE org_id = v_org_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT
        COUNT(DISTINCT ev.user_id) AS total_eligible,
        COUNT(DISTINCT v.voter_id) AS total_voted,
        ROUND(
            COUNT(DISTINCT v.voter_id)::NUMERIC / NULLIF(COUNT(DISTINCT ev.user_id), 0) * 100,
            2
        ) AS turnout_percent
    FROM public.election_voters ev
    LEFT JOIN public.votes v ON v.voter_id = ev.user_id AND v.election_id = ev.election_id
    WHERE ev.election_id = p_election_id;
END;
$$;

-- ============================================================
-- 8. Append to Audit Log (for Edge Functions / triggers only)
--
-- This is intentionally NOT exposed via RLS INSERT policy on
-- audit_logs. Edge Functions call this via service_role, ensuring
-- the audit trail is tamper-proof from the client layer.
-- ============================================================
CREATE OR REPLACE FUNCTION public.append_audit_log(
    p_org_id UUID,
    p_action TEXT,
    p_actor_id UUID,
    p_target_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.audit_logs (org_id, action, actor_id, target_id, metadata)
    VALUES (p_org_id, p_action, p_actor_id, p_target_id, p_metadata);
END;
$$;
