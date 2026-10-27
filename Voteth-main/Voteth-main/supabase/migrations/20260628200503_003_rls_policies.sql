-- 003_rls_policies.sql
-- Enables RLS on all tables and defines precise access boundaries.

-- Enable RLS everywhere
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_fraud_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. User Profiles
CREATE POLICY "Profiles are readable by everyone" ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Organizations
CREATE POLICY "Members can view their organizations" ON public.organizations FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.org_memberships WHERE org_id = id AND user_id = auth.uid())
);
CREATE POLICY "Authenticated users can create organizations" ON public.organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can update organizations" ON public.organizations FOR UPDATE USING (public.is_org_admin(id));

-- 3. Org Members
CREATE POLICY "Members can see other members in their org" ON public.org_memberships FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.org_memberships my_om WHERE my_om.org_id = org_id AND my_om.user_id = auth.uid())
);
CREATE POLICY "Admins can manage members" ON public.org_memberships FOR ALL USING (public.is_org_admin(org_id));

-- 4. Elections
CREATE POLICY "Org members can view elections" ON public.elections FOR SELECT USING (public.is_election_org_member(id));
CREATE POLICY "Admins can create elections" ON public.elections FOR INSERT WITH CHECK (public.is_org_admin(org_id));
CREATE POLICY "Admins can update elections if not published" ON public.elections FOR UPDATE USING (
    public.is_org_admin(org_id) AND status IN ('draft', 'open', 'closed')
);

-- 5. Candidates
CREATE POLICY "Org members can view candidates" ON public.candidates FOR SELECT USING (public.is_election_org_member(election_id));
CREATE POLICY "Admins can manage candidates" ON public.candidates FOR ALL USING (public.is_election_admin(election_id));
CREATE POLICY "Users can update their own candidate profile" ON public.candidates FOR UPDATE USING (user_id = auth.uid());

-- 6. Election Voters
CREATE POLICY "Org members can view allowlist" ON public.election_voters FOR SELECT USING (public.is_election_org_member(election_id));
CREATE POLICY "Admins can manage allowlist" ON public.election_voters FOR ALL USING (public.is_election_admin(election_id));

-- 7. Votes (Highest Security)
-- Note: NO admin read access. ONLY the voter can read their own vote.
CREATE POLICY "Voters can view their own votes" ON public.votes FOR SELECT USING (voter_id = auth.uid());
CREATE POLICY "Voters can insert votes if election is open" ON public.votes FOR INSERT WITH CHECK (
    voter_id = auth.uid() AND
    public.is_election_voter(election_id) AND
    EXISTS (SELECT 1 FROM public.elections WHERE id = election_id AND status = 'open')
);
-- NO UPDATE, NO DELETE policy for votes. Immutable.

-- 8. QR Codes
CREATE POLICY "Users can view their own QR codes" ON public.qr_codes FOR SELECT USING (voter_id = auth.uid());
CREATE POLICY "Admins can manage QR codes" ON public.qr_codes FOR ALL USING (public.is_election_admin(election_id));

-- 9. AI Fraud Flags
CREATE POLICY "Admins can view fraud flags" ON public.ai_fraud_flags FOR SELECT USING (public.is_election_admin(election_id));
CREATE POLICY "Admins can update fraud flag status" ON public.ai_fraud_flags FOR UPDATE USING (public.is_election_admin(election_id));
-- Note: NO INSERT policy for clients. Edge functions (service_role) only.

-- 10. Audit Logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.is_org_admin(org_id));
-- Note: NO INSERT/UPDATE/DELETE policy. Edge functions/triggers only.
