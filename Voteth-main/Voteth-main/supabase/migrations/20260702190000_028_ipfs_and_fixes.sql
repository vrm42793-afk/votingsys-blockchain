-- Migration: 20260702190000_028_ipfs_and_fixes.sql
-- Description: Adds ipfs_cid column to elections and candidates, and fixes get_election_results RPC.

-- 1. Add IPFS CID columns
ALTER TABLE public.elections 
ADD COLUMN IF NOT EXISTS ipfs_cid TEXT;

ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS ipfs_cid TEXT;

CREATE INDEX IF NOT EXISTS idx_elections_ipfs_cid ON public.elections(ipfs_cid);
CREATE INDEX IF NOT EXISTS idx_candidates_ipfs_cid ON public.candidates(ipfs_cid);

-- 2. Update get_election_results RPC to support organization_id column on org_memberships
-- Returns candidate vote counts without exposing voter IDs or individual ballots.
CREATE OR REPLACE FUNCTION public.get_election_results(p_election_id UUID)
RETURNS TABLE (
    candidate_id UUID,
    candidate_name TEXT,
    vote_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status public.election_status;
    v_org_id UUID;
BEGIN
    -- Validate the election exists and get its status & org_id
    SELECT status, org_id
    INTO v_status, v_org_id
    FROM public.elections
    WHERE id = p_election_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found';
    END IF;

    -- Caller must be member of the election's organization or platform owner
    IF NOT EXISTS (
        SELECT 1 FROM public.org_memberships
        WHERE organization_id = v_org_id AND user_id = auth.uid()
    ) AND public.get_my_platform_role() != 'owner' THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Return empty set if election is not published or closed
    IF v_status NOT IN ('published', 'closed') THEN
        RETURN;
    END IF;

    -- Return aggregate counts only - no voter IDs or timestamps exposed
    RETURN QUERY
    SELECT
        c.id AS candidate_id,
        c.name AS candidate_name,
        COUNT(v.id)::BIGINT AS vote_count
    FROM public.candidates c
    LEFT JOIN public.votes v ON v.candidate_id = c.id AND v.election_id = p_election_id
    WHERE c.election_id = p_election_id
      AND c.status = 'approved'
    GROUP BY c.id, c.name, c.display_order
    ORDER BY c.display_order ASC, c.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_election_results(UUID) TO authenticated;
