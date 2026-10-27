-- 022_protect_platform_role.sql
-- Enforces strict server-side protection preventing users from elevating their own platform_role.
-- Only platform owners, service_role, or postgres superusers can alter platform_role.

CREATE OR REPLACE FUNCTION public.protect_user_platform_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if platform_role is being modified
    IF (OLD.platform_role IS DISTINCT FROM NEW.platform_role) THEN
        -- Allow direct database superusers / migration runners (e.g. Supabase dashboard SQL editor, psql, migrations)
        IF (current_user IN ('postgres', 'supabase_admin') OR session_user IN ('postgres', 'supabase_admin')) THEN
            RETURN NEW;
        END IF;

        -- Allow service_role (e.g. Supabase Admin API / backend workers)
        IF (COALESCE(auth.jwt() ->> 'role', '') = 'service_role') THEN
            RETURN NEW;
        END IF;

        -- Allow authenticated platform owners
        IF (public.get_my_platform_role() = 'owner') THEN
            RETURN NEW;
        END IF;

        -- Otherwise block the update with an error
        RAISE EXCEPTION 'Unauthorized: Only platform owners can modify platform_role';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_user_platform_role ON public.user_profiles;
CREATE TRIGGER tr_protect_user_platform_role
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_user_platform_role();
