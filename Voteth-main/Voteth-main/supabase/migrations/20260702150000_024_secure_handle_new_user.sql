-- 20260702150000_024_secure_handle_new_user.sql
-- Security Remediation (Phase 3.2):
-- Fixes privilege escalation on user signup.
-- Guarantees that ALL new user registrations default strictly to 'voter'.
-- Completely ignores untrusted raw_user_meta_data fields (e.g. platform_role, role).
-- Enforces fixed search_path = public, auth, pg_temp on the SECURITY DEFINER function.
-- Preserves existing platform owner accounts and legitimate role promotion workflows.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_full_name TEXT;
BEGIN
    -- Extract only user-safe display metadata
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

    -- HARD INVARIANT: All newly registered accounts default strictly to 'voter'.
    -- User-supplied client metadata (raw_user_meta_data) must NEVER dictate privilege levels.
    -- Organizer and Platform Owner roles must only be granted through authorized promotion
    -- by an existing platform owner or verified administrative workflow.
    BEGIN
        INSERT INTO public.user_profiles (
            id,
            email,
            full_name,
            platform_role,
            is_suspended,
            wallet_address
        )
        VALUES (
            NEW.id,
            NEW.email,
            v_full_name,
            'voter',
            false,
            NULL
        );
    EXCEPTION 
        WHEN unique_violation THEN
            -- Re-signup / duplicate handler: update full_name only; NEVER overwrite platform_role
            UPDATE public.user_profiles
            SET full_name = CASE 
                    WHEN v_full_name <> '' THEN v_full_name 
                    ELSE full_name 
                END
            WHERE id = NEW.id;
        WHEN OTHERS THEN
            RAISE WARNING '[handle_new_user] Failed to create profile for %: %', NEW.email, SQLERRM;
            RETURN NEW;
    END;

    RETURN NEW;
END;
$$;

-- Ensure trigger is bound to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Additionally protect user_profiles against direct unprivileged INSERT of elevated roles
CREATE OR REPLACE FUNCTION public.protect_user_platform_role_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- If platform_role is 'voter', it is always safe
    IF (NEW.platform_role = 'voter' OR NEW.platform_role IS NULL) THEN
        NEW.platform_role := 'voter';
        RETURN NEW;
    END IF;

    -- Elevating to 'organizer' or 'owner' on insert requires administrative privilege
    IF (current_user IN ('postgres', 'supabase_admin') OR session_user IN ('postgres', 'supabase_admin')) THEN
        RETURN NEW;
    END IF;

    IF (COALESCE(auth.jwt() ->> 'role', '') = 'service_role') THEN
        RETURN NEW;
    END IF;

    IF (public.get_my_platform_role() = 'owner') THEN
        RETURN NEW;
    END IF;

    -- Block unauthorized elevated role insert
    RAISE EXCEPTION 'Unauthorized: Only platform owners or administrators can initialize non-voter platform roles';
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_user_platform_role_insert ON public.user_profiles;
CREATE TRIGGER tr_protect_user_platform_role_insert
    BEFORE INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_user_platform_role_insert();
