-- =============================================================================
-- Migration: org_invitations table
-- Description: Tracks pending invitations to organizations for users who may
--              not yet have registered. Once the user registers and logs in,
--              pending invitations are redeemed into org_memberships.
-- Requirements: ORG-04
-- =============================================================================

-- 1. Create the invitations table
CREATE TABLE public.org_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role org_role NOT NULL DEFAULT 'viewer',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    invited_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    UNIQUE(org_id, email, status)  -- Prevent duplicate pending invitations
);

CREATE INDEX idx_org_invitations_email ON public.org_invitations(email);
CREATE INDEX idx_org_invitations_org_id ON public.org_invitations(org_id);

-- 2. Enable RLS
ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Org admins can view all invitations for their org
CREATE POLICY "org_invitations: admins can read org invitations"
  ON public.org_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.org_id = org_invitations.org_id
        AND om.role = 'admin'
    )
  );

-- Org admins can create invitations
CREATE POLICY "org_invitations: admins can insert invitations"
  ON public.org_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.org_id = org_invitations.org_id
        AND om.role = 'admin'
    )
  );

-- Org admins can update invitations (revoke)
CREATE POLICY "org_invitations: admins can update invitations"
  ON public.org_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.org_id = org_invitations.org_id
        AND om.role = 'admin'
    )
  );

-- Org admins can delete invitations
CREATE POLICY "org_invitations: admins can delete invitations"
  ON public.org_invitations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS om
      WHERE om.user_id = auth.uid()
        AND om.org_id = org_invitations.org_id
        AND om.role = 'admin'
    )
  );

-- Users can see invitations addressed to their own email
-- (looked up via auth.jwt() ->> 'email')
CREATE POLICY "org_invitations: users can see their own invitations"
  ON public.org_invitations
  FOR SELECT
  USING (
    email = (auth.jwt() ->> 'email')
  );

-- =============================================================================
-- 4. Auto-redeem pending invitations on login
--
-- This function is called after a user profile is created (via handle_new_user).
-- It checks for any pending invitations matching the user's email and converts
-- them into org_memberships.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.redeem_pending_invitations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_email TEXT;
    v_invitation RECORD;
BEGIN
    -- Get the user's email from auth.users
    SELECT email INTO v_email
    FROM auth.users
    WHERE id = NEW.id;

    IF v_email IS NULL THEN
        RETURN NEW;
    END IF;

    -- Find all pending, non-expired invitations for this email
    FOR v_invitation IN
        SELECT id, org_id, role
        FROM public.org_invitations
        WHERE email = v_email
          AND status = 'pending'
          AND expires_at > NOW()
    LOOP
        -- Create the membership (ignore conflicts if already a member)
        INSERT INTO public.org_memberships (org_id, user_id, role)
        VALUES (v_invitation.org_id, NEW.id, v_invitation.role)
        ON CONFLICT (org_id, user_id) DO NOTHING;

        -- Mark invitation as accepted
        UPDATE public.org_invitations
        SET status = 'accepted'
        WHERE id = v_invitation.id;
    END LOOP;

    RETURN NEW;
END;
$$;

-- Fire after a new user_profiles row is created (which happens via handle_new_user)
CREATE TRIGGER on_profile_created_redeem_invitations
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.redeem_pending_invitations();
