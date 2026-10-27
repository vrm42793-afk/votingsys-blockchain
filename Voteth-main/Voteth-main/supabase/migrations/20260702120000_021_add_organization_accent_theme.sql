-- 021_add_organization_accent_theme.sql
-- Add accent_theme column to public.organizations with default 'purple'
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS accent_theme TEXT DEFAULT 'purple' CHECK (accent_theme IN ('purple', 'blue', 'emerald', 'rose'));
