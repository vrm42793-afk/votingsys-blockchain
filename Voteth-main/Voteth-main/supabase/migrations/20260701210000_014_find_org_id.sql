-- 014_find_org_id.sql
CREATE OR REPLACE FUNCTION public.find_org_id_references()
RETURNS TABLE (func_name TEXT, func_src TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT proname::TEXT, prosrc::TEXT 
    FROM pg_proc 
    WHERE prosrc ILIKE '%org_memberships%' AND prosrc ILIKE '%org_id%';
$$;
