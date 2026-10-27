-- 012_test_trigger_directly.sql
CREATE OR REPLACE FUNCTION public.debug_trigger_error(
    p_email TEXT,
    p_full_name TEXT,
    p_org_name TEXT,
    p_org_slug TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_err TEXT;
BEGIN
    v_user_id := gen_random_uuid();
    
    BEGIN
        -- Attempt to insert directly into auth.users to fire the handle_new_user trigger
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_user_meta_data,
            created_at,
            updated_at,
            aud,
            role
        ) VALUES (
            v_user_id,
            '00000000-0000-0000-0000-000000000000',
            p_email,
            'fake_hash',
            NOW(),
            jsonb_build_object(
                'full_name', p_full_name,
                'platform_role', 'organizer',
                'org_name', p_org_name,
                'org_slug', p_org_slug
            ),
            NOW(),
            NOW(),
            'authenticated',
            'authenticated'
        );
        
        RETURN 'SUCCESS';
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
        RETURN 'ERROR: ' || v_err;
    END;
END;
$$;
