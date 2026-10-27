-- 007_platform_owner_dashboard.sql
-- Implements database changes for Milestone 2 (Platform Owner Dashboard)
-- Adds status/activity columns and configures RLS bypass for the Platform Owner.

-- 1. Alter organizations to add is_active status
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Alter user_profiles to add is_suspended status
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Alter audit_logs org_id to be nullable (enables platform-wide logging)
ALTER TABLE public.audit_logs ALTER COLUMN org_id DROP NOT NULL;

-- 4. Enable RLS Policies for Platform Owners
-- Create policies allowing platform owners to select and update everything.

-- user_profiles policies
CREATE POLICY owner_select_all_profiles ON public.user_profiles
    FOR SELECT TO authenticated
    USING (
        (SELECT platform_role FROM public.user_profiles WHERE id = auth.uid()) = 'owner'
    );

CREATE POLICY owner_update_all_profiles ON public.user_profiles
    FOR UPDATE TO authenticated
    USING (
        (SELECT platform_role FROM public.user_profiles WHERE id = auth.uid()) = 'owner'
    );

-- organizations policies
CREATE POLICY owner_select_all_orgs ON public.organizations
    FOR SELECT TO authenticated
    USING (
        (SELECT platform_role FROM public.user_profiles WHERE id = auth.uid()) = 'owner'
    );

CREATE POLICY owner_update_all_orgs ON public.organizations
    FOR UPDATE TO authenticated
    USING (
        (SELECT platform_role FROM public.user_profiles WHERE id = auth.uid()) = 'owner'
    );

CREATE POLICY owner_delete_all_orgs ON public.organizations
    FOR DELETE TO authenticated
    USING (
        (SELECT platform_role FROM public.user_profiles WHERE id = auth.uid()) = 'owner'
    );

-- org_memberships policies
CREATE POLICY owner_select_all_memberships ON public.org_memberships
    FOR SELECT TO authenticated
    USING (
        (SELECT platform_role FROM public.user_profiles WHERE id = auth.uid()) = 'owner'
    );

CREATE POLICY owner_update_all_memberships ON public.org_memberships
    FOR UPDATE TO authenticated
    USING (
        (SELECT platform_role FROM public.user_profiles WHERE id = auth.uid()) = 'owner'
    );

-- elections policies
CREATE POLICY owner_select_all_elections ON public.elections
    FOR SELECT TO authenticated
    USING (
        (SELECT platform_role FROM public.user_profiles WHERE id = auth.uid()) = 'owner'
    );

-- votes policies
CREATE POLICY owner_select_all_votes ON public.votes
    FOR SELECT TO authenticated
    USING (
        (SELECT platform_role FROM public.user_profiles WHERE id = auth.uid()) = 'owner'
    );

-- audit_logs policies
CREATE POLICY owner_select_all_audit_logs ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        (SELECT platform_role FROM public.user_profiles WHERE id = auth.uid()) = 'owner'
    );

CREATE POLICY owner_insert_all_audit_logs ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT platform_role FROM public.user_profiles WHERE id = auth.uid()) = 'owner'
    );
