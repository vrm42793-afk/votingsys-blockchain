-- Migration: 20260702220000_031_voter_membership_and_approvals.sql
-- Description: Adds status ('pending', 'approved', 'rejected') and timestamps to org_memberships,
-- enables voter membership requests, organizer approval/rejection workflows, and automated
-- synchronization with election voter allowlists.

-- 1. Add status and timestamp columns to org_memberships
ALTER TABLE public.org_memberships 
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.org_memberships 
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.org_memberships 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_org_memberships_status 
    ON public.org_memberships(organization_id, status);

-- 2. Allow authenticated users (voters) to submit membership requests to organizations
DROP POLICY IF EXISTS "org_memberships: voters can request membership" ON public.org_memberships;
CREATE POLICY "org_memberships: voters can request membership"
    ON public.org_memberships
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND
        role = 'viewer' AND
        status = 'pending'
    );

-- 3. Ensure users can always read their own membership status
DROP POLICY IF EXISTS "org_memberships: users can read own rows" ON public.org_memberships;
CREATE POLICY "org_memberships: users can read own rows"
    ON public.org_memberships
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- 4. Org Admins can update membership roles and approval status
DROP POLICY IF EXISTS "org_memberships: admins can update members" ON public.org_memberships;
CREATE POLICY "org_memberships: admins can update members"
    ON public.org_memberships
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.org_memberships om
            WHERE om.organization_id = org_memberships.organization_id
              AND om.user_id = auth.uid()
              AND om.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.org_memberships om
            WHERE om.organization_id = org_memberships.organization_id
              AND om.user_id = auth.uid()
              AND om.role = 'admin'
        )
    );

-- 5. Org Admins can delete memberships (remove voters/members)
DROP POLICY IF EXISTS "org_memberships: admins can delete members" ON public.org_memberships;
CREATE POLICY "org_memberships: admins can delete members"
    ON public.org_memberships
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.org_memberships om
            WHERE om.organization_id = org_memberships.organization_id
              AND om.user_id = auth.uid()
              AND om.role = 'admin'
        )
    );

-- 6. Automated allowlist sync on approval
CREATE OR REPLACE FUNCTION public.handle_member_approval_allowlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM NEW.status OR TG_OP = 'INSERT')) THEN
        -- Add voter to all draft and open elections for this organization
        INSERT INTO public.election_voters (election_id, user_id, added_by)
        SELECT e.id, NEW.user_id, COALESCE(auth.uid(), NEW.user_id)
        FROM public.elections e
        WHERE e.org_id = NEW.organization_id
          AND e.status IN ('draft', 'open')
        ON CONFLICT (election_id, user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_approval_allowlist ON public.org_memberships;
CREATE TRIGGER trg_member_approval_allowlist
    AFTER INSERT OR UPDATE OF status ON public.org_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_member_approval_allowlist();

-- 7. Automated allowlist cleanup on rejection or member removal
CREATE OR REPLACE FUNCTION public.handle_member_removal_allowlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_org_id UUID;
    v_user_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_org_id := OLD.organization_id;
        v_user_id := OLD.user_id;
    ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'rejected' AND OLD.status = 'approved') THEN
        v_org_id := NEW.organization_id;
        v_user_id := NEW.user_id;
    ELSE
        RETURN NEW;
    END IF;

    DELETE FROM public.election_voters ev
    USING public.elections e
    WHERE ev.election_id = e.id
      AND e.org_id = v_org_id
      AND ev.user_id = v_user_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_removal_allowlist ON public.org_memberships;
CREATE TRIGGER trg_member_removal_allowlist
    AFTER UPDATE OF status OR DELETE ON public.org_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_member_removal_allowlist();
