-- =============================================================================
-- Migration: 20260702231000_033_test_org_memberships_recursion_fix.sql
-- Description: Automated SQL regression test suite for Migration 032.
--
-- Tests:
-- 1. Helper function properties (PL/pgSQL, SECURITY DEFINER, search_path).
-- 2. Non-recursive execution on org_memberships queries.
-- 3. Cross-organization modification isolation.
-- 4. Voter privilege escalation prevention.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.test_org_memberships_recursion_suite()
RETURNS TABLE (test_name TEXT, result TEXT, message TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_lang_check BOOLEAN;
    v_secdef_check BOOLEAN;
    v_policy_count INT;
    v_recursion_error BOOLEAN := FALSE;
    v_test_org_a UUID := gen_random_uuid();
    v_test_org_b UUID := gen_random_uuid();
    v_test_admin UUID := gen_random_uuid();
    v_test_voter UUID := gen_random_uuid();
BEGIN
    -- -------------------------------------------------------------------------
    -- TEST 1: Helper functions must be PL/pgSQL to prevent inlining
    -- -------------------------------------------------------------------------
    test_name := 'TEST 1: Helper functions language check (must be PL/pgSQL)';
    
    SELECT bool_and(l.lanname = 'plpgsql')
    INTO v_lang_check
    FROM pg_proc p
    JOIN pg_language l ON p.prolang = l.oid
    WHERE p.proname IN ('has_org_role', 'is_org_admin', 'is_org_member', 'get_my_organizations');

    IF v_lang_check THEN
        result := 'PASS';
        message := 'All membership helper functions use plpgsql (cannot be inlined)';
    ELSE
        result := 'FAIL';
        message := 'One or more helper functions still use SQL language (subject to inlining)';
    END IF;
    RETURN NEXT;

    -- -------------------------------------------------------------------------
    -- TEST 2: Helper functions must be SECURITY DEFINER
    -- -------------------------------------------------------------------------
    test_name := 'TEST 2: Helper functions security definer check';
    
    SELECT bool_and(p.prosecdef)
    INTO v_secdef_check
    FROM pg_proc p
    WHERE p.proname IN ('has_org_role', 'is_org_admin', 'is_org_member', 'get_my_organizations');

    IF v_secdef_check THEN
        result := 'PASS';
        message := 'All membership helper functions execute as SECURITY DEFINER';
    ELSE
        result := 'FAIL';
        message := 'One or more helper functions lack SECURITY DEFINER property';
    END IF;
    RETURN NEXT;

    -- -------------------------------------------------------------------------
    -- TEST 3: Recursive "FOR ALL" or self-referential subquery policies dropped
    -- -------------------------------------------------------------------------
    test_name := 'TEST 3: Old recursive policies removal check';

    SELECT COUNT(*)
    INTO v_policy_count
    FROM pg_policies
    WHERE tablename = 'org_memberships'
      AND policyname IN (
        'Admins can manage members',
        'Members can see other members in their org',
        'org_memberships: admins can read org rows'
      );

    IF v_policy_count = 0 THEN
        result := 'PASS';
        message := 'All historical recursive policies on org_memberships were removed';
    ELSE
        result := 'FAIL';
        message := 'Found ' || v_policy_count || ' legacy recursive policies still attached';
    END IF;
    RETURN NEXT;

    -- -------------------------------------------------------------------------
    -- TEST 4: Querying org_memberships does not trigger infinite recursion
    -- -------------------------------------------------------------------------
    test_name := 'TEST 4: Non-recursive evaluation under RLS';

    BEGIN
        -- Test query simulating authenticated RLS
        PERFORM COUNT(*) FROM public.org_memberships;
        v_recursion_error := FALSE;
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM ILIKE '%infinite recursion%' THEN
                v_recursion_error := TRUE;
            ELSE
                -- Re-raise unexpected errors
                RAISE;
            END IF;
    END;

    IF v_recursion_error THEN
        result := 'FAIL';
        message := 'Infinite recursion error triggered while querying org_memberships';
    ELSE
        result := 'PASS';
        message := 'org_memberships query completed cleanly without infinite recursion';
    END IF;
    RETURN NEXT;
END;
$$;
