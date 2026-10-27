-- 008_organizer_settings_archive.sql
-- Implements database column additions to support Milestone 3 features:
-- Adds description to organizations, is_archived to elections, and display_order to candidates.

-- 1. Alter organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Alter elections
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS is_active_eligibility TEXT CHECK (is_active_eligibility IN ('entire_org', 'selected_groups', 'voter_list')) DEFAULT 'entire_org';
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Alter candidates
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
