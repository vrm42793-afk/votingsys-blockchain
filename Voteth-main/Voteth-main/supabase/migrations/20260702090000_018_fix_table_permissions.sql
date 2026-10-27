-- 018_fix_table_permissions.sql
-- Grants table-level SELECT/INSERT/UPDATE/DELETE permissions to the
-- 'authenticated' role so that RLS policies can actually take effect.
-- Without these GRANTs, authenticated users get "permission denied"
-- even though RLS policies exist.

-- Core tables
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.elections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.election_voters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.votes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_fraud_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_invitations TO authenticated;

-- Allow the anon role to read profiles (for public display)
GRANT SELECT ON public.user_profiles TO anon;
