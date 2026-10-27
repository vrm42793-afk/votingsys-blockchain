-- 023_test_protect_platform_role.sql
-- Automated verification suite for the protect_user_platform_role trigger.
-- Tests:
-- 1. Unauthorized privilege escalation (voter -> owner) is BLOCKED.
-- 2. Legitimate promotion by platform owner is ALLOWED.
-- 3. Non-role profile update by regular voter is ALLOWED.

CREATE OR REPLACE FUNCTION public.run_platform_role_security_tests()
RETURNS TABLE (test_name TEXT, passed BOOLEAN, detail TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_owner_id UUID := gen_random_uuid();
    v_voter_id UUID := gen_random_uuid();
    v_err_message TEXT;
    v_test_passed BOOLEAN;
BEGIN
    -- Setup mock users in auth.users and user_profiles
    INSERT INTO auth.users (id, email, aud, role, created_at, updated_at)
    VALUES 
        (v_owner_id, 'test_owner@voteth.io', 'authenticated', 'authenticated', NOW(), NOW()),
        (v_voter_id, 'test_voter@voteth.io', 'authenticated', 'authenticated', NOW(), NOW());

    INSERT INTO public.user_profiles (id, email, full_name, platform_role)
    VALUES 
        (v_owner_id, 'test_owner@voteth.io', 'Test Owner', 'owner'),
        (v_voter_id, 'test_voter@voteth.io', 'Test Voter', 'voter');

    -- TEST 1: Normal Profile Update (voter updates their full_name)
    BEGIN
        -- Simulate authenticated voter session
        PERFORM set_config('request.jwt.claim.sub', v_voter_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        UPDATE public.user_profiles 
        SET full_name = 'Updated Voter Name'
        WHERE id = v_voter_id;

        test_name := 'Voter Normal Profile Update';
        passed := TRUE;
        detail := 'Voter successfully updated non-role fields without trigger interference.';
        RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
        test_name := 'Voter Normal Profile Update';
        passed := FALSE;
        detail := 'FAILED: ' || SQLERRM;
        RETURN NEXT;
    END;

    -- TEST 2: Unauthorized Escalation (voter tries to set platform_role = owner)
    BEGIN
        -- Simulate authenticated voter session
        PERFORM set_config('request.jwt.claim.sub', v_voter_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        UPDATE public.user_profiles 
        SET platform_role = 'owner'
        WHERE id = v_voter_id;

        -- If it did not raise an exception, the test failed
        test_name := 'Unauthorized Escalation Blocked';
        passed := FALSE;
        detail := 'CRITICAL: Trigger failed to prevent voter from elevating to owner!';
        RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_err_message = MESSAGE_TEXT;
        IF v_err_message LIKE '%Unauthorized: Only platform owners can modify platform_role%' THEN
            test_name := 'Unauthorized Escalation Blocked';
            passed := TRUE;
            detail := 'SUCCESS: Blocked with expected message: ' || v_err_message;
        ELSE
            test_name := 'Unauthorized Escalation Blocked';
            passed := FALSE;
            detail := 'FAILED: Blocked with unexpected error: ' || v_err_message;
        END IF;
        RETURN NEXT;
    END;

    -- TEST 3: Legitimate Promotion by Platform Owner
    BEGIN
        -- Simulate authenticated owner session
        PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        UPDATE public.user_profiles 
        SET platform_role = 'organizer'
        WHERE id = v_voter_id;

        test_name := 'Owner Legitimate Promotion';
        passed := TRUE;
        detail := 'SUCCESS: Platform owner successfully promoted voter to organizer.';
        RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
        test_name := 'Owner Legitimate Promotion';
        passed := FALSE;
        detail := 'FAILED: Owner was blocked from promoting user: ' || SQLERRM;
        RETURN NEXT;
    END;

    -- Cleanup test data
    DELETE FROM public.user_profiles WHERE id IN (v_owner_id, v_voter_id);
    DELETE FROM auth.users WHERE id IN (v_owner_id, v_voter_id);

    -- Reset session config
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', '', true);
END;
$$;
