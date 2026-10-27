-- Migration: 20260702200000_029_fix_organization_creation.sql
-- Description: Fixes organization creation for authenticated users (ORG-01),
-- ensures creators become organization admins, and fixes RLS SELECT visibility on insert.

-- 1. Allow authenticated users to create organizations (ORG-01)
DROP POLICY IF EXISTS "Organizers and owners can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations"
    ON public.organizations
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Guard organization insert: force owner_id to auth.uid()
CREATE OR REPLACE FUNCTION public.handle_new_organization_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (current_user IN ('postgres', 'supabase_admin') OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role') THEN
        RETURN NEW;
    END IF;

    -- Authenticated user must exist
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User must be signed in to create an organization';
    END IF;

    NEW.owner_id := auth.uid();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_organization_insert ON public.organizations;
CREATE TRIGGER tr_guard_organization_insert
    BEFORE INSERT ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_organization_guard();

-- 3. Auto-assign creator as admin member and promote voter to organizer
CREATE OR REPLACE FUNCTION public.handle_new_organization_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Insert admin membership for creator
    INSERT INTO public.org_memberships (organization_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'admin')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    -- Promote platform_role from voter to organizer upon creating an organization
    UPDATE public.user_profiles
    SET platform_role = 'organizer'
    WHERE id = NEW.owner_id
      AND platform_role = 'voter';

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_auto_organization_admin_membership ON public.organizations;
CREATE TRIGGER tr_auto_organization_admin_membership
    AFTER INSERT ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_organization_membership();

-- 4. Fix RLS SELECT policy on public.organizations so RETURNING * succeeds immediately
DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Members and owners can view their organizations" ON public.organizations;
CREATE POLICY "Members and owners can view their organizations"
    ON public.organizations
    FOR SELECT
    TO authenticated
    USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.org_memberships AS om
            WHERE om.organization_id = organizations.id
              AND om.user_id = auth.uid()
        ) OR
        public.get_my_platform_role() = 'owner'
    );
