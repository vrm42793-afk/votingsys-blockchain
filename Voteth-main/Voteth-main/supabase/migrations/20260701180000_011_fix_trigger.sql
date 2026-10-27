-- 011_fix_trigger.sql
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
        
        -- Insert organization (omitted owner_id to test if FK is the issue)
        INSERT INTO public.organizations (id, name, slug)
        VALUES (
            v_org_id,
            v_org_name,
            COALESCE(v_org_slug, lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g')))
        );
        
        -- Insert owner membership
        INSERT INTO public.org_memberships (organization_id, user_id, role)
        VALUES (v_org_id, NEW.id, 'admin');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
