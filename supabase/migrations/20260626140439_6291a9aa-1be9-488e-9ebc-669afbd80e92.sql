REVOKE EXECUTE ON FUNCTION public.accept_landlord_invite(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_landlord_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_current_tenant_property(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.accept_landlord_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_landlord_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_tenant_property(uuid) TO authenticated;