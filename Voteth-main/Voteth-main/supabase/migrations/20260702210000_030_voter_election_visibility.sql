-- Migration: 20260702210000_030_voter_election_visibility.sql
-- Description: Enables voter election discovery, public organization details for ballots,
-- candidate profile visibility, and voter allowlist self-verification.

-- 1. Elections SELECT policy: Allow authenticated voters to see open/published elections,
-- elections they are allowlisted for, or elections in their organizations.
DROP POLICY IF EXISTS "elections: members can read own org elections" ON public.elections;
DROP POLICY IF EXISTS "Org members can view elections" ON public.elections;
DROP POLICY IF EXISTS "Voters and members can view available elections" ON public.elections;

CREATE POLICY "Voters and members can view available elections"
  ON public.elections
  FOR SELECT
  TO authenticated
  USING (
    status IN ('open', 'published', 'closed') OR
    EXISTS (
      SELECT 1 FROM public.election_voters AS ev
      WHERE ev.election_id = elections.id
        AND ev.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = elections.org_id
    ) OR
    public.get_my_platform_role() = 'owner'
  );

-- 2. Candidates SELECT policy: Allow approved candidates to be viewed by voters
DROP POLICY IF EXISTS "Org members can view candidates" ON public.candidates;
DROP POLICY IF EXISTS "Voters and members can view candidates" ON public.candidates;

CREATE POLICY "Voters and members can view candidates"
  ON public.candidates
  FOR SELECT
  TO authenticated
  USING (
    status = 'approved' OR
    EXISTS (
      SELECT 1 FROM public.elections e
      JOIN public.org_memberships om ON om.organization_id = e.org_id
      WHERE e.id = candidates.election_id
        AND om.user_id = auth.uid()
    ) OR
    public.get_my_platform_role() = 'owner'
  );

-- 3. Organizations SELECT policy: Allow authenticated users to view organization names and metadata
DROP POLICY IF EXISTS "Members and owners can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations;

CREATE POLICY "Authenticated users can view organizations"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 4. Election Voters SELECT policy: Allow voters to check their own eligibility
DROP POLICY IF EXISTS "Org members can view allowlist" ON public.election_voters;
DROP POLICY IF EXISTS "Voters and members can view allowlist" ON public.election_voters;

CREATE POLICY "Voters and members can view allowlist"
  ON public.election_voters
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_election_admin(election_id) OR
    public.get_my_platform_role() = 'owner'
  );
