-- 1. Create SECURITY DEFINER function to check email confirmation status
CREATE OR REPLACE FUNCTION public.is_email_confirmed()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT email_confirmed_at IS NOT NULL
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_email_confirmed() TO authenticated;

-- 2. Transactional RPC for atomic property creation
CREATE OR REPLACE FUNCTION public.create_property_atomic(
  p_nickname text,
  p_address text,
  p_city text,
  p_state text,
  p_zip_code text,
  p_property_type text,
  p_landlord_id uuid,
  p_manager_id uuid,
  p_default_management_fee numeric DEFAULT 10
)
RETURNS uuid AS $$
DECLARE
    v_property_id uuid;
BEGIN
    -- Validation: Ensure manager exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_manager_id) THEN
        RAISE EXCEPTION 'Manager not found';
    END IF;

    -- Validation: Ensure landlord exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_landlord_id) THEN
        RAISE EXCEPTION 'Landlord profile not found';
    END IF;

    INSERT INTO public.properties (
        nickname,
        address,
        city,
        state,
        zip_code,
        property_type,
        landlord_id,
        user_id, -- Historic field used as agency link in RLS
        default_management_fee_percent
    ) VALUES (
        p_nickname,
        p_address,
        p_city,
        p_state,
        p_zip_code,
        p_property_type,
        p_landlord_id,
        p_manager_id,
        p_default_management_fee
    ) RETURNING id INTO v_property_id;

    RETURN v_property_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_property_atomic(text, text, text, text, text, text, uuid, uuid, numeric) TO authenticated;
