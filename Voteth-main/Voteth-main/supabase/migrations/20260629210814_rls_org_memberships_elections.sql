-- =============================================================================
-- Migration: RLS policies for org_memberships and elections
-- Description: Establishes row-level security boundaries for multi-tenant
--              organization membership and election data isolation.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: org_memberships
-- -----------------------------------------------------------------------------

ALTER TABLE org_memberships ENABLE ROW LEVEL SECURITY;

-- 1a. Users can read their own memberships only.
CREATE POLICY "org_memberships: members can read own rows"
  ON org_memberships
  FOR SELECT
  USING (user_id = auth.uid());

-- 1b. Org admins can read all memberships within their organization.
CREATE POLICY "org_memberships: admins can read org rows"
  ON org_memberships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.org_id = org_memberships.org_id
        AND om.role = 'admin'
    )
  );

-- 1c. Org admins can insert new members into their organization.
CREATE POLICY "org_memberships: admins can insert members"
  ON org_memberships
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.org_id = org_memberships.org_id
        AND om.role = 'admin'
    )
  );

-- 1d. Org admins can update roles within their organization.
--     Users can NOT self-escalate — the admin check prevents it.
CREATE POLICY "org_memberships: admins can update member roles"
  ON org_memberships
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.org_id = org_memberships.org_id
        AND om.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.org_id = org_memberships.org_id
        AND om.role = 'admin'
    )
  );

-- 1e. Org admins can remove members from their organization.
--     Users can also remove themselves (leave org).
CREATE POLICY "org_memberships: admins can delete members"
  ON org_memberships
  FOR DELETE
  USING (
    user_id = auth.uid() -- self-removal (leave org)
    OR EXISTS (
      SELECT 1 FROM org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.org_id = org_memberships.org_id
        AND om.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- SECTION 2: elections
-- -----------------------------------------------------------------------------

ALTER TABLE elections ENABLE ROW LEVEL SECURITY;

-- 2a. Any org member can read elections belonging to their organization.
CREATE POLICY "elections: members can read own org elections"
  ON elections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.org_id = elections.org_id
    )
  );

-- 2b. Only org admins can create elections.
CREATE POLICY "elections: admins can insert"
  ON elections
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.org_id = elections.org_id
        AND om.role = 'admin'
    )
  );

-- 2c. Only org admins can update elections.
--     ⚠️ Election config lock (ELEC-07) is enforced at the application layer,
--     not here — RLS cannot inspect old vs new row state for this logic.
CREATE POLICY "elections: admins can update"
  ON elections
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.org_id = elections.org_id
        AND om.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.org_id = elections.org_id
        AND om.role = 'admin'
    )
  );

-- 2d. Only org admins can delete elections.
--     ⚠️ Consider soft-delete (is_archived) instead of hard DELETE in production.
CREATE POLICY "elections: admins can delete"
  ON elections
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.org_id = elections.org_id
        AND om.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- SECTION 3: Safety verification queries
-- Run these manually in the Supabase SQL editor after applying to confirm.
-- -----------------------------------------------------------------------------

-- Verify RLS is enabled on both tables:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE tablename IN ('org_memberships', 'elections');

-- Verify all policies exist:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('org_memberships', 'elections')
-- ORDER BY tablename, cmd;
