-- 001_core_schema.sql
-- Enables core extensions, defines enums, tables, constraints, and indexes.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE org_role AS ENUM ('admin', 'moderator', 'viewer');
CREATE TYPE election_status AS ENUM ('draft', 'open', 'closed', 'published');
CREATE TYPE election_type AS ENUM ('single_choice', 'multi_choice');
CREATE TYPE candidate_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');
CREATE TYPE qr_status AS ENUM ('active', 'used', 'expired');
CREATE TYPE fraud_severity AS ENUM ('low', 'medium', 'high');
CREATE TYPE fraud_status AS ENUM ('open', 'dismissed', 'escalated');

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. User Profiles (Extends auth.users)
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    wallet_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Organizations
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Organization Memberships
CREATE TABLE public.org_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role org_role NOT NULL DEFAULT 'viewer',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_memberships_user_id ON public.org_memberships(user_id);
CREATE INDEX idx_org_memberships_org_id ON public.org_memberships(org_id);

-- 4. Elections
CREATE TABLE public.elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    election_type election_type NOT NULL DEFAULT 'single_choice',
    status election_status NOT NULL DEFAULT 'draft',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    max_votes_per_voter INTEGER NOT NULL DEFAULT 1,
    on_chain_election_id BIGINT,
    chain_tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date > start_date)
);

CREATE INDEX idx_elections_org_id ON public.elections(org_id);

CREATE TRIGGER update_elections_updated_at
    BEFORE UPDATE ON public.elections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Candidates
CREATE TABLE public.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    bio TEXT,
    photo_url TEXT,
    status candidate_status NOT NULL DEFAULT 'pending',
    ai_summary TEXT,
    on_chain_candidate_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candidates_election_id ON public.candidates(election_id);

CREATE TRIGGER update_candidates_updated_at
    BEFORE UPDATE ON public.candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Election Voters (Allowlist)
CREATE TABLE public.election_voters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    added_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    UNIQUE(election_id, user_id)
);

CREATE INDEX idx_election_voters_election_id ON public.election_voters(election_id);
CREATE INDEX idx_election_voters_user_id ON public.election_voters(user_id);

-- 7. Votes (Append Only Ledger)
CREATE TABLE public.votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE RESTRICT,
    vote_hash TEXT NOT NULL UNIQUE,
    chain_tx_hash TEXT,
    chain_block_number BIGINT,
    is_chain_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(election_id, voter_id) -- Prevents off-chain double voting
);

CREATE INDEX idx_votes_election_candidate ON public.votes(election_id, candidate_id);
CREATE INDEX idx_votes_voter_id ON public.votes(voter_id);

-- 8. QR Codes
CREATE TABLE public.qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    status qr_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qr_codes_token ON public.qr_codes(token);

-- 9. AI Fraud Flags
CREATE TABLE public.ai_fraud_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    severity fraud_severity NOT NULL,
    affected_pattern TEXT,
    affected_voter_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    status fraud_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dismissed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    escalated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_fraud_flags_election_id ON public.ai_fraud_flags(election_id);

-- 10. Audit Logs (Append Only)
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    target_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org_id ON public.audit_logs(org_id);
