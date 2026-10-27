-- 015_drop_redundant_trigger.sql
-- Drop the redundant and broken trigger on organizations
DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
DROP FUNCTION IF EXISTS public.handle_new_organization() CASCADE;
