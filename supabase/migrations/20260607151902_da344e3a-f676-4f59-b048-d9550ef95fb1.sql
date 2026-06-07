
-- 1) Hide asaas_accounts.api_key from client reads via column-level privileges
REVOKE SELECT (api_key) ON public.asaas_accounts FROM authenticated;
REVOKE SELECT (api_key) ON public.asaas_accounts FROM anon;

-- 2) Lock down trigger functions that should never be callable directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_installments_for_contract() FROM PUBLIC, anon, authenticated;
