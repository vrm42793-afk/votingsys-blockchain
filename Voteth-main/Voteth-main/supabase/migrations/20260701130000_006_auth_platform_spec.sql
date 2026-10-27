-- 006_auth_platform_spec.sql
-- Alters schema to align strictly with Phase 1 specs.
-- Adds platform_role, email to user_profiles, owner_id to organizations,
-- and updates org_memberships schema & keys.

-- 1. Alter user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS platform_role TEXT CHECK (platform_role IN ('owner', 'organizer', 'voter')) DEFAULT 'voter';

-- Populate email and platform_role for existing user profiles
UPDATE public.user_profiles up
SET email = u.email,
    platform_role = CASE
        WHEN u.email = 'vrentrepreneur41@gmail.com' THEN 'owner'
        ELSE 'voter'
    END
FROM auth.users u
WHERE up.id = u.id;

-- Enforce constraints
ALTER TABLE public.user_profiles ALTER COLUMN email SET NOT NULL;
ALTER TABLE public.user_profiles ALTER COLUMN platform_role SET NOT NULL;

-- 2. Alter organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- 3. Alter org_memberships

-- 3a. Drop all direct-query policies referencing org_memberships columns
DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Members can see other members in their org" ON public.org_memberships;

-- Drop all other policies on org_memberships, elections, and org_invitations referencing org_memberships columns
DROP POLICY IF EXISTS "org_memberships: members can read own rows" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships: admins can read org rows" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships: admins can insert members" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships: admins can update member roles" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships: admins can delete members" ON public.org_memberships;

DROP POLICY IF EXISTS "elections: members can read own org elections" ON public.elections;
DROP POLICY IF EXISTS "elections: admins can insert" ON public.elections;
DROP POLICY IF EXISTS "elections: admins can update" ON public.elections;
DROP POLICY IF EXISTS "elections: admins can delete" ON public.elections;

DROP POLICY IF EXISTS "org_invitations: admins can read org invitations" ON public.org_invitations;
DROP POLICY IF EXISTS "org_invitations: admins can insert invitations" ON public.org_invitations;
DROP POLICY IF EXISTS "org_invitations: admins can update invitations" ON public.org_invitations;
DROP POLICY IF EXISTS "org_invitations: admins can delete invitations" ON public.org_invitations;

-- Drop dependent helper functions (CASCADE will clean up any other dependent policies)
DROP FUNCTION IF EXISTS public.is_election_voter(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_election_org_member(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_election_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_org_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.has_org_role(UUID, org_role[]) CASCADE;
DROP FUNCTION IF EXISTS public.has_org_role(UUID, TEXT[]) CASCADE;

-- Drop PK
ALTER TABLE public.org_memberships DROP CONSTRAINT IF EXISTS org_memberships_pkey;

-- Rename org_id to organization_id
ALTER TABLE public.org_memberships RENAME COLUMN org_id TO organization_id;

-- Alter role to TEXT
ALTER TABLE public.org_memberships ALTER COLUMN role TYPE TEXT;

-- Drop id column
ALTER TABLE public.org_memberships DROP COLUMN IF EXISTS id;

-- Set composite PK
ALTER TABLE public.org_memberships ADD PRIMARY KEY (organization_id, user_id);

-- 3b. Re-create all helper functions with updated names and roles
CREATE OR REPLACE FUNCTION public.has_org_role(org_uuid UUID, allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.org_memberships
        WHERE organization_id = org_uuid
        AND user_id = auth.uid()
        AND role = ANY(allowed_roles)
    );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(org_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.has_org_role(org_uuid, ARRAY['admin'::text]);
$$;

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

CREATE OR REPLACE FUNCTION public.is_election_org_member(election_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.org_memberships om
        JOIN public.elections e ON e.org_id = om.organization_id
        WHERE e.id = election_uuid
        AND om.user_id = auth.uid()
    );
$$;

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

-- 3c. Re-create all dependent RLS policies

-- organizations
CREATE POLICY "Members can view their organizations" ON public.organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE organization_id = id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update organizations" ON public.organizations
  FOR UPDATE
  USING (public.is_org_admin(id));

-- org_memberships
CREATE POLICY "Members can see other members in their org" ON public.org_memberships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships my_om
      WHERE my_om.organization_id = organization_id AND my_om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage members" ON public.org_memberships
  FOR ALL
  USING (public.is_org_admin(organization_id));

CREATE POLICY "org_memberships: members can read own rows"
  ON public.org_memberships
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "org_memberships: admins can read org rows"
  ON public.org_memberships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = org_memberships.organization_id
        AND om.role = 'admin'
    )
  );

CREATE POLICY "org_memberships: admins can insert members"
  ON public.org_memberships
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = org_memberships.organization_id
        AND om.role = 'admin'
    )
  );

CREATE POLICY "org_memberships: admins can update member roles"
  ON public.org_memberships
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = org_memberships.organization_id
        AND om.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = org_memberships.organization_id
        AND om.role = 'admin'
    )
  );

CREATE POLICY "org_memberships: admins can delete members"
  ON public.org_memberships
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = org_memberships.organization_id
        AND om.role = 'admin'
    )
  );

-- elections
CREATE POLICY "Org members can view elections" ON public.elections
  FOR SELECT
  USING (public.is_election_org_member(id));

CREATE POLICY "Admins can create elections" ON public.elections
  FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY "Admins can update elections if not published" ON public.elections
  FOR UPDATE
  USING (
    public.is_org_admin(org_id) AND status IN ('draft', 'open', 'closed')
  );

CREATE POLICY "elections: members can read own org elections"
  ON public.elections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = elections.org_id
    )
  );

CREATE POLICY "elections: admins can insert"
  ON public.elections
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = elections.org_id
        AND om.role = 'admin'
    )
  );

CREATE POLICY "elections: admins can update"
  ON public.elections
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = elections.org_id
        AND om.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = elections.org_id
        AND om.role = 'admin'
    )
  );

CREATE POLICY "elections: admins can delete"
  ON public.elections
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = elections.org_id
        AND om.role = 'admin'
    )
  );

-- candidates
CREATE POLICY "Org members can view candidates" ON public.candidates
  FOR SELECT
  USING (public.is_election_org_member(election_id));

CREATE POLICY "Admins can manage candidates" ON public.candidates
  FOR ALL
  USING (public.is_election_admin(election_id));

-- election_voters
CREATE POLICY "Org members can view allowlist" ON public.election_voters
  FOR SELECT
  USING (public.is_election_org_member(election_id));

CREATE POLICY "Admins can manage allowlist" ON public.election_voters
  FOR ALL
  USING (public.is_election_admin(election_id));

-- votes
CREATE POLICY "Voters can insert votes if election is open" ON public.votes
  FOR INSERT
  WITH CHECK (
    voter_id = auth.uid() AND
    public.is_election_voter(election_id) AND
    EXISTS (SELECT 1 FROM public.elections WHERE id = election_id AND status = 'open')
  );

-- qr_codes
CREATE POLICY "Admins can manage QR codes" ON public.qr_codes
  FOR ALL
  USING (public.is_election_admin(election_id));

-- ai_fraud_flags
CREATE POLICY "Admins can view fraud flags" ON public.ai_fraud_flags
  FOR SELECT
  USING (public.is_election_admin(election_id));

CREATE POLICY "Admins can update fraud flag status" ON public.ai_fraud_flags
  FOR UPDATE
  USING (public.is_election_admin(election_id));

-- audit_logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT
  USING (public.is_org_admin(org_id));

-- org_invitations
CREATE POLICY "org_invitations: admins can read org invitations"
  ON public.org_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = org_invitations.org_id
        AND om.role = 'admin'
    )
  );

CREATE POLICY "org_invitations: admins can insert invitations"
  ON public.org_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = org_invitations.org_id
        AND om.role = 'admin'
    )
  );

CREATE POLICY "org_invitations: admins can update invitations"
  ON public.org_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = org_invitations.org_id
        AND om.role = 'admin'
    )
  );

CREATE POLICY "org_invitations: admins can delete invitations"
  ON public.org_invitations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = org_invitations.org_id
        AND om.role = 'admin'
    )
  );

-- 4. Update handle_new_user trigger function with automatic organization onboarding
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role TEXT;
    v_org_name TEXT;
    v_org_slug TEXT;
    v_org_id UUID;
BEGIN
    IF NEW.email = 'vrentrepreneur41@gmail.com' THEN
        v_role := 'owner';
    ELSE
        v_role := COALESCE(NEW.raw_user_meta_data->>'platform_role', 'voter');
    END IF;

    -- Create profile
    INSERT INTO public.user_profiles (id, email, full_name, platform_role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        v_role
    );

    -- Auto-onboarding for organizations if metadata is present
    v_org_name := NEW.raw_user_meta_data->>'org_name';
    v_org_slug := NEW.raw_user_meta_data->>'org_slug';
    
    IF v_role = 'organizer' AND v_org_name IS NOT NULL AND v_org_name <> '' THEN
        v_org_id := gen_random_uuid();
        
        -- Insert organization
        INSERT INTO public.organizations (id, name, slug, owner_id)
        VALUES (
            v_org_id,
            v_org_name,
            COALESCE(v_org_slug, lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g'))),
            NEW.id
        );
        
        -- Insert owner membership
        INSERT INTO public.org_memberships (organization_id, user_id, role)
        VALUES (v_org_id, NEW.id, 'admin');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update redeem_pending_invitations function
CREATE OR REPLACE FUNCTION public.redeem_pending_invitations()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.org_memberships (organization_id, user_id, role)
    SELECT org_id, NEW.id, role
    FROM public.org_invitations
    WHERE email = NEW.email AND status = 'pending';

    UPDATE public.org_invitations
    SET status = 'accepted'
    WHERE email = NEW.email AND status = 'pending';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
