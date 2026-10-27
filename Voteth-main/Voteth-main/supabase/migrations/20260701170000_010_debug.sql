-- 010_debug.sql
CREATE OR REPLACE FUNCTION public.debug_insert_org(
    p_org_name TEXT,
    p_org_slug TEXT,
    p_user_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_org_id UUID;
    v_err TEXT;
BEGIN
    v_org_id := gen_random_uuid();
    
    BEGIN
        INSERT INTO public.organizations (id, name, slug, owner_id)
        VALUES (
            v_org_id,
            p_org_name,
            p_org_slug,
            p_user_id
        );
        
        INSERT INTO public.org_memberships (organization_id, user_id, role)
        VALUES (v_org_id, p_user_id, 'admin');
        
        RETURN 'SUCCESS';
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
        RETURN 'ERROR: ' || v_err;
    END;
END;
$$;
