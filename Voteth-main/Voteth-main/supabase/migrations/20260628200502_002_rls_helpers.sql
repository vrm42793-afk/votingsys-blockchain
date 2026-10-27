-- 002_rls_helpers.sql
-- Helper functions to simplify RLS policies and reduce boilerplate.

-- Check if a user has a specific role in an organization
CREATE OR REPLACE FUNCTION public.has_org_role(org_uuid UUID, allowed_roles org_role[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.org_memberships
        WHERE org_id = org_uuid
        AND user_id = auth.uid()
        AND role = ANY(allowed_roles)
    );
$$;

-- Check if user is an admin of an organization
CREATE OR REPLACE FUNCTION public.is_org_admin(org_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.has_org_role(org_uuid, ARRAY['admin'::public.org_role]);
$$;

-- Check if a user is an admin of the election's organization
CREATE OR REPLACE FUNCTION public.is_election_admin(election_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.is_org_admin(
        (SELECT org_id FROM public.elections WHERE id = election_uuid)
    );
$$;

-- Check if user is a member of the election's organization
CREATE OR REPLACE FUNCTION public.is_election_org_member(election_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.org_memberships om
        JOIN public.elections e ON e.org_id = om.org_id
        WHERE e.id = election_uuid
        AND om.user_id = auth.uid()
    );
$$;

-- Check if a user is explicitly allowed to vote in an election
CREATE OR REPLACE FUNCTION public.is_election_voter(election_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.election_voters
        WHERE election_id = election_uuid
        AND user_id = auth.uid()
    );
$$;
