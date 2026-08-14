-- 1. Mass Delete Prevention
CREATE OR REPLACE FUNCTION public.prevent_mass_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow service_role to delete if explicitly permitted by a session variable
    IF current_setting('role') = 'service_role' AND current_setting('nexo.allow_mass_delete', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Mass delete prevented for service_role. Set nexo.allow_mass_delete = true if intended.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke execute from public to harden
REVOKE EXECUTE ON FUNCTION public.prevent_mass_delete() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_mass_delete() TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_mass_delete() TO postgres;

-- Apply to sensitive tables
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('contracts', 'installments', 'properties', 'tenants', 'profiles')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS tr_prevent_mass_delete ON public.%I', t);
        EXECUTE format('CREATE TRIGGER tr_prevent_mass_delete BEFORE DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_mass_delete()', t);
    END LOOP;
END;
$$;

-- 2. Enhanced Financial Payout Validation Helper
CREATE OR REPLACE FUNCTION public.verify_payout_integrity(p_installment_id uuid)
RETURNS boolean AS $$
DECLARE
    v_amount decimal;
    v_paid_amount decimal;
    v_nexo_fee decimal := 24.99;
    v_mgmt_percent decimal;
    v_landlord_amount decimal;
    v_calculated_landlord decimal;
BEGIN
    SELECT amount, paid_amount, management_fee_percent, landlord_payout_amount
    INTO v_amount, v_paid_amount, v_mgmt_percent, v_landlord_amount
    FROM public.installments
    WHERE id = p_installment_id AND status = 'pago';

    IF NOT FOUND THEN RETURN false; END IF;

    v_calculated_landlord := (COALESCE(v_paid_amount, v_amount) - v_nexo_fee) * (1 - COALESCE(v_mgmt_percent, 0) / 100);
    
    IF abs(COALESCE(v_landlord_amount, 0) - v_calculated_landlord) > 0.10 THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Revoke execute from public to harden
REVOKE EXECUTE ON FUNCTION public.verify_payout_integrity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_payout_integrity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_payout_integrity(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_payout_integrity(uuid) TO postgres;
