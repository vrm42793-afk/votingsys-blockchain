-- 013_fix_invitation_trigger.sql
-- Fixes the handle_accepted_invitation trigger to use organization_id instead of org_id for org_memberships
-- Restores owner_id to the organizations insert in handle_new_user

CREATE OR REPLACE FUNCTION public.handle_accepted_invitation()
RETURNS TRIGGER AS $$
DECLARE
    v_invitation RECORD;
BEGIN
    -- Check if there's a pending invitation for this email
    SELECT id, org_id, role 
    INTO v_invitation
    FROM public.org_invitations
    WHERE email = NEW.email AND status = 'pending'
    LIMIT 1;

    IF FOUND THEN
        -- Add user to the organization (using organization_id instead of org_id)
        INSERT INTO public.org_memberships (organization_id, user_id, role)
        VALUES (v_invitation.org_id, NEW.id, v_invitation.role)
        ON CONFLICT (organization_id, user_id) DO NOTHING;

        -- Update invitation status
        UPDATE public.org_invitations
        SET status = 'accepted', updated_at = NOW()
        WHERE id = v_invitation.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


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
        
        -- Insert organization (restored owner_id)
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
