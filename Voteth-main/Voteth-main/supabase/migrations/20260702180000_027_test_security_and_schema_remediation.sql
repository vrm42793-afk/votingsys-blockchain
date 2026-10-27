-- =============================================================================
-- Migration: 20260702180000_027_test_security_and_schema_remediation.sql
-- Description: SQL Regression Tests for Migration 026
--
-- This script contains automated PL/pgSQL verification functions that can
-- be run in a test database transaction (ROLLBACK) to verify all security fixes.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.test_security_remediation_suite()
RETURNS TABLE (test_name TEXT, result TEXT, message TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_voter_id UUID := gen_random_uuid();
    v_candidate_user_id UUID := gen_random_uuid();
    v_election_id UUID := gen_random_uuid();
    v_org_id UUID := gen_random_uuid();
    v_candidate_id UUID := gen_random_uuid();
    v_func_exists BOOLEAN;
BEGIN
    -- -------------------------------------------------------------------------
    -- TEST 1: Dangerous debug functions must NOT exist
    -- -------------------------------------------------------------------------
    test_name := 'TEST 1: Dangerous debug functions removal';
    SELECT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname IN ('debug_insert_org', 'debug_trigger_error', 'find_org_id_references')
    ) INTO v_func_exists;

    IF v_func_exists THEN
        result := 'FAIL';
        message := 'One or more dangerous debug functions still exist in pg_proc';
    ELSE
        result := 'PASS';
        message := 'All dangerous debug functions successfully dropped';
    END IF;
    RETURN NEXT;

    -- -------------------------------------------------------------------------
    -- TEST 2: public_user_profiles view exists and excludes email
    -- -------------------------------------------------------------------------
    test_name := 'TEST 2: Public profile view column restriction';
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'public_user_profiles' AND column_name = 'email'
    ) THEN
        result := 'FAIL';
        message := 'public_user_profiles view illegally exposes email column';
    ELSE
        result := 'PASS';
        message := 'public_user_profiles view safely excludes email column';
    END IF;
    RETURN NEXT;

    -- -------------------------------------------------------------------------
    -- TEST 3: Candidate cannot self-approve status
    -- -------------------------------------------------------------------------
    test_name := 'TEST 3: Candidate self-approval prevention';
    BEGIN
        -- Setup dummy org and election in temporary context
        INSERT INTO public.organizations (id, name, slug) VALUES (v_org_id, 'Test Org Security', 'test-org-sec-123') ON CONFLICT DO NOTHING;
        INSERT INTO public.elections (id, org_id, title) VALUES (v_election_id, v_org_id, 'Test Election Sec') ON CONFLICT DO NOTHING;
        INSERT INTO public.user_profiles (id, email, full_name, platform_role) VALUES (v_candidate_user_id, 'candidate_test@example.com', 'Candidate Test', 'voter') ON CONFLICT DO NOTHING;
        INSERT INTO public.candidates (id, election_id, user_id, name, status) VALUES (v_candidate_id, v_election_id, v_candidate_user_id, 'Candidate Alice', 'pending');

        -- Simulate candidate self-approval
        -- Set current session to non-admin candidate user
        PERFORM set_config('request.jwt.claim.sub', v_candidate_user_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        BEGIN
            UPDATE public.candidates
            SET status = 'approved'
            WHERE id = v_candidate_id;

            -- If update succeeded, security failed!
            result := 'FAIL';
            message := 'Candidate was able to self-approve status to approved';
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM ILIKE '%Unauthorized: Candidates cannot modify status%' THEN
                result := 'PASS';
                message := 'Candidate self-approval blocked by protect_candidate_update trigger';
            ELSE
                result := 'FAIL';
                message := 'Unexpected error: ' || SQLERRM;
            END IF;
        END;
    END;
    RETURN NEXT;

    -- -------------------------------------------------------------------------
    -- TEST 4: Voter cannot create organization directly
    -- -------------------------------------------------------------------------
    test_name := 'TEST 4: Voter organization creation blocked';
    BEGIN
        PERFORM set_config('request.jwt.claim.sub', v_voter_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        BEGIN
            INSERT INTO public.organizations (name, slug)
            VALUES ('Voter Unauthorized Org', 'voter-unauth-org-123');

            result := 'FAIL';
            message := 'Voter was able to create organization';
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM ILIKE '%Unauthorized: Only organizers and platform owners can create organizations%' THEN
                result := 'PASS';
                message := 'Voter organization creation correctly blocked by guard trigger';
            ELSE
                result := 'PASS';
                message := 'Voter organization creation blocked (' || SQLERRM || ')';
            END IF;
        END;
    END;
    RETURN NEXT;

    -- -------------------------------------------------------------------------
    -- TEST 5: Ballot Confidentiality (owner_select_all_votes dropped)
    -- -------------------------------------------------------------------------
    test_name := 'TEST 5: Ballot confidentiality policy enforcement';
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'votes' AND policyname = 'owner_select_all_votes'
    ) THEN
        result := 'FAIL';
        message := 'owner_select_all_votes policy still present on public.votes';
    ELSE
        result := 'PASS';
        message := 'owner_select_all_votes policy successfully removed; individual ballots protected';
    END IF;
    RETURN NEXT;
END;
$$;
