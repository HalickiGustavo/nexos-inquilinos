ALTER TYPE public.installment_status ADD VALUE IF NOT EXISTS 'divergente';

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'efi_charges_txid_key') THEN
        ALTER TABLE public.efi_charges ADD CONSTRAINT efi_charges_txid_key UNIQUE (txid);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.check_contract_integrity(p_contract_id uuid)
RETURNS boolean AS $$
DECLARE
    v_property_owner_id uuid;
    v_contract_property_id uuid;
    v_contract_manager_id uuid;
BEGIN
    SELECT property_id, user_id INTO v_contract_property_id, v_contract_manager_id
    FROM public.contracts
    WHERE id = p_contract_id;

    IF v_contract_property_id IS NULL THEN
        RETURN false;
    END IF;

    -- Verifica se o imóvel pertence ao mesmo manager do contrato
    IF NOT EXISTS (
        SELECT 1 FROM public.properties 
        WHERE id = v_contract_property_id AND (user_id = v_contract_manager_id OR manager_id = v_contract_manager_id)
    ) THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_contract_integrity(uuid) TO authenticated, service_role;