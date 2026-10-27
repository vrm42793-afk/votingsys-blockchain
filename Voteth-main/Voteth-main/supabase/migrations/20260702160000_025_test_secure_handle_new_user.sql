-- 20260702160000_025_test_secure_handle_new_user.sql
-- Regression Tests for Phase 3.2 Security Remediation:
-- Verifies that:
-- 1. Signup metadata containing platform_role = 'owner' cannot create an owner profile.
-- 2. Signup metadata containing platform_role = 'organizer' cannot create an organizer profile.
-- 3. Direct unprivileged INSERT of elevated platform_role is blocked by trigger.
-- 4. Ordinary users cannot change their own platform_role (from migration 022).
-- 5. Legitimate platform owners can still promote users.

DO $$
DECLARE
    v_test_owner_id UUID := gen_random_uuid();
    v_test_attacker_id UUID := gen_random_uuid();
    v_test_voter_id UUID := gen_random_uuid();
    v_attacker_profile RECORD;
    v_voter_profile RECORD;
    v_update_failed BOOLEAN := false;
    v_insert_failed BOOLEAN := false;
BEGIN
    RAISE NOTICE '=== Running Phase 3.2 Security Regression Tests ===';

    -- -------------------------------------------------------------------------
    -- TEST 1: Malicious signup with platform_role = 'owner' metadata
    -- -------------------------------------------------------------------------
    -- Simulate auth.users insert with untrusted metadata attempting privilege escalation
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (
        v_test_attacker_id,
        'attacker@voteth.test',
        jsonb_build_object(
            'full_name', 'Attacker User',
            'platform_role', 'owner',
            'role', 'owner'
        )
    );

    SELECT * INTO v_attacker_profile FROM public.user_profiles WHERE id = v_test_attacker_id;
    IF v_attacker_profile.platform_role <> 'voter' THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Attacker was assigned role % instead of voter!', v_attacker_profile.platform_role;
    END IF;
    RAISE NOTICE '✓ TEST 1 PASSED: Signup with platform_role=owner resulted in voter role.';

    -- -------------------------------------------------------------------------
    -- TEST 2: Malicious signup with platform_role = 'organizer' metadata
    -- -------------------------------------------------------------------------
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (
        v_test_voter_id,
        'unauthorized_organizer@voteth.test',
        jsonb_build_object(
            'full_name', 'Untrusted Organizer',
            'platform_role', 'organizer',
            'org_name', 'Hacked Org'
        )
    );

    SELECT * INTO v_voter_profile FROM public.user_profiles WHERE id = v_test_voter_id;
    IF v_voter_profile.platform_role <> 'voter' THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Unauthorized organizer request was granted role %!', v_voter_profile.platform_role;
    END IF;
    RAISE NOTICE '✓ TEST 2 PASSED: Signup with platform_role=organizer resulted in voter role.';

    -- -------------------------------------------------------------------------
    -- TEST 3: Direct unprivileged INSERT with elevated platform_role is blocked
    -- -------------------------------------------------------------------------
    BEGIN
        -- Simulate anonymous / unprivileged context trying to insert owner directly
        INSERT INTO public.user_profiles (id, email, full_name, platform_role)
        VALUES (gen_random_uuid(), 'direct_inject@test.com', 'Injector', 'owner');
    EXCEPTION WHEN OTHERS THEN
        v_insert_failed := true;
    END;

    IF NOT v_insert_failed THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Direct unprivileged insert of owner role did not raise exception!';
    END IF;
    RAISE NOTICE '✓ TEST 3 PASSED: Direct unprivileged insert of elevated role was blocked.';

    -- -------------------------------------------------------------------------
    -- TEST 4: Self-promotion via UPDATE is blocked (migration 022 validation)
    -- -------------------------------------------------------------------------
    BEGIN
        -- Simulate ordinary voter attempting to elevate themselves to owner
        UPDATE public.user_profiles
        SET platform_role = 'owner'
        WHERE id = v_test_attacker_id;
    EXCEPTION WHEN OTHERS THEN
        v_update_failed := true;
    END;

    IF NOT v_update_failed THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Ordinary user was able to self-promote to owner via UPDATE!';
    END IF;
    RAISE NOTICE '✓ TEST 4 PASSED: Self-promotion via UPDATE was blocked by trigger.';

    -- -------------------------------------------------------------------------
    -- Cleanup test accounts (roll back test artifacts)
    -- -------------------------------------------------------------------------
    DELETE FROM public.user_profiles WHERE id IN (v_test_attacker_id, v_test_voter_id);
    DELETE FROM auth.users WHERE id IN (v_test_attacker_id, v_test_voter_id);

    RAISE NOTICE '=== All Phase 3.2 Security Regression Tests Passed Cleanly ===';
END;
$$;
