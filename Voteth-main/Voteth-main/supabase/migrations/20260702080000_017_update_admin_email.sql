-- 017_update_admin_email.sql
-- Updates the platform owner email and re-applies the handle_new_user trigger.

-- 1. Update existing user profiles to transfer the owner role
UPDATE public.user_profiles
SET platform_role = 'voter'
WHERE platform_role = 'owner';

UPDATE public.user_profiles
SET platform_role = 'owner'
WHERE email = 'vemareddy080307@gmail.com';

-- 2. Update the trigger to use the new email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role TEXT;
    v_org_name TEXT;
    v_org_slug TEXT;
    v_org_id UUID;
BEGIN
    IF NEW.email = 'vemareddy080307@gmail.com' THEN
        v_role := 'owner';
    ELSE
        v_role := COALESCE(NEW.raw_user_meta_data->>'platform_role', 'voter');
    END IF;

    -- Create profile — this MUST succeed for signup to work
    BEGIN
        INSERT INTO public.user_profiles (id, email, full_name, platform_role)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            v_role
        );
    EXCEPTION WHEN unique_violation THEN
        -- Profile already exists (e.g. re-signup with same email), update instead
        UPDATE public.user_profiles
        SET full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', full_name),
            platform_role = v_role
        WHERE id = NEW.id;
    WHEN OTHERS THEN
        RAISE WARNING '[handle_new_user] Failed to create profile for %: %', NEW.email, SQLERRM;
        -- Still return NEW so the auth.users row is created
        RETURN NEW;
    END;

    -- Auto-onboarding for organizations if metadata is present
    v_org_name := NEW.raw_user_meta_data->>'org_name';
    v_org_slug := NEW.raw_user_meta_data->>'org_slug';
    
    IF v_role = 'organizer' AND v_org_name IS NOT NULL AND v_org_name <> '' THEN
        BEGIN
            v_org_id := gen_random_uuid();
            
            -- Generate a unique slug — append random suffix if collision
            IF v_org_slug IS NULL OR v_org_slug = '' THEN
                v_org_slug := lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g'));
            END IF;

            -- Insert organization with owner_id
            INSERT INTO public.organizations (id, name, slug, owner_id)
            VALUES (
                v_org_id,
                v_org_name,
                v_org_slug,
                NEW.id
            );
            
            -- Insert owner membership
            INSERT INTO public.org_memberships (organization_id, user_id, role)
            VALUES (v_org_id, NEW.id, 'admin');
        EXCEPTION 
            WHEN unique_violation THEN
                -- Slug collision — retry with a unique suffix
                BEGIN
                    v_org_slug := v_org_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
                    INSERT INTO public.organizations (id, name, slug, owner_id)
                    VALUES (
                        v_org_id,
                        v_org_name,
                        v_org_slug,
                        NEW.id
                    );
                    
                    INSERT INTO public.org_memberships (organization_id, user_id, role)
                    VALUES (v_org_id, NEW.id, 'admin');
                EXCEPTION WHEN OTHERS THEN
                    RAISE WARNING '[handle_new_user] Failed to create org (retry) for %: %', NEW.email, SQLERRM;
                END;
            WHEN OTHERS THEN
                RAISE WARNING '[handle_new_user] Failed to create org for %: %', NEW.email, SQLERRM;
                -- Don't abort — the user profile was already created successfully
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
