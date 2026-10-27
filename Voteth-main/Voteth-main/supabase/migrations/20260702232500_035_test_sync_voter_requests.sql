-- =============================================================================
-- Migration: 20260702232500_035_test_sync_voter_requests.sql
-- Description: Verification script for migration 034.
-- =============================================================================

DO $$
DECLARE
    v_has_status BOOLEAN;
    v_fn_exists BOOLEAN;
BEGIN
    -- 1. Check election_voters status column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'election_voters' 
          AND column_name = 'status'
    ) INTO v_has_status;

    IF NOT v_has_status THEN
        RAISE EXCEPTION 'TEST FAILED: status column missing from election_voters';
    END IF;

    -- 2. Check check_voter_election_eligibility function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'check_voter_election_eligibility'
          AND p.prosecdef = TRUE
    ) INTO v_fn_exists;

    IF NOT v_fn_exists THEN
        RAISE EXCEPTION 'TEST FAILED: check_voter_election_eligibility function is missing or not SECURITY DEFINER';
    END IF;

    RAISE NOTICE 'SUCCESS: Migration 034 verified successfully.';
END;
$$;
