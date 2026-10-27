-- 020_expand_audit_logs_and_settings.sql
-- 1. Create Platform Settings Table
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO public.platform_settings (key, value)
VALUES ('maintenance_mode', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS on platform settings
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Select policy: Authenticated users can read settings
CREATE POLICY select_platform_settings ON public.platform_settings
    FOR SELECT TO authenticated
    USING (true);

-- Admin policy: Platform Owners can modify settings
CREATE POLICY manage_platform_settings ON public.platform_settings
    FOR ALL TO authenticated
    USING (public.get_my_platform_role() = 'owner');

-- 2. Expand Audit Logs Table
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_type TEXT;

-- 3. Automatic Request Header Extraction Trigger
CREATE OR REPLACE FUNCTION public.process_audit_log_headers()
RETURNS TRIGGER AS $$
DECLARE
  v_headers TEXT;
  v_headers_json JSONB;
BEGIN
  -- Retrieve request headers from Supabase/PostgREST session context
  v_headers := current_setting('request.headers', true);
  
  IF v_headers IS NOT NULL AND v_headers <> '' THEN
    v_headers_json := v_headers::jsonb;
    -- Extract IP address and User Agent securely
    NEW.ip_address := COALESCE(v_headers_json->>'x-forwarded-for', v_headers_json->>'x-real-ip');
    NEW.user_agent := v_headers_json->>'user-agent';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger to execute before any audit log is written
DROP TRIGGER IF EXISTS audit_logs_headers_trigger ON public.audit_logs;
CREATE TRIGGER audit_logs_headers_trigger
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_headers();

-- 4. Maintenance Mode Security Guard Trigger (Restricts DB Writes)
CREATE OR REPLACE FUNCTION public.check_maintenance_mode()
RETURNS TRIGGER AS $$
DECLARE
  v_maint_enabled BOOLEAN;
BEGIN
  -- Safely fetch maintenance mode status
  SELECT COALESCE((value->>'enabled')::boolean, false)
  INTO v_maint_enabled
  FROM public.platform_settings
  WHERE key = 'maintenance_mode';

  IF v_maint_enabled = true THEN
    -- Exception triggers rollback and returns error to user
    RAISE EXCEPTION 'Restricted Action: VotEth 2.0 is currently undergoing system maintenance.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach maintenance check trigger to all core write-active tables
-- Organizations
DROP TRIGGER IF EXISTS trg_maint_organizations ON public.organizations;
CREATE TRIGGER trg_maint_organizations
    BEFORE INSERT OR UPDATE OR DELETE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.check_maintenance_mode();

-- Memberships
DROP TRIGGER IF EXISTS trg_maint_org_memberships ON public.org_memberships;
CREATE TRIGGER trg_maint_org_memberships
    BEFORE INSERT OR UPDATE OR DELETE ON public.org_memberships
    FOR EACH ROW EXECUTE FUNCTION public.check_maintenance_mode();

-- Elections
DROP TRIGGER IF EXISTS trg_maint_elections ON public.elections;
CREATE TRIGGER trg_maint_elections
    BEFORE INSERT OR UPDATE OR DELETE ON public.elections
    FOR EACH ROW EXECUTE FUNCTION public.check_maintenance_mode();

-- Candidates
DROP TRIGGER IF EXISTS trg_maint_candidates ON public.candidates;
CREATE TRIGGER trg_maint_candidates
    BEFORE INSERT OR UPDATE OR DELETE ON public.candidates
    FOR EACH ROW EXECUTE FUNCTION public.check_maintenance_mode();

-- Votes
DROP TRIGGER IF EXISTS trg_maint_votes ON public.votes;
CREATE TRIGGER trg_maint_votes
    BEFORE INSERT OR UPDATE OR DELETE ON public.votes
    FOR EACH ROW EXECUTE FUNCTION public.check_maintenance_mode();

-- Invitations
DROP TRIGGER IF EXISTS trg_maint_org_invitations ON public.org_invitations;
CREATE TRIGGER trg_maint_org_invitations
    BEFORE INSERT OR UPDATE OR DELETE ON public.org_invitations
    FOR EACH ROW EXECUTE FUNCTION public.check_maintenance_mode();
