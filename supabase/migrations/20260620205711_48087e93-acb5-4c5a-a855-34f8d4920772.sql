
REVOKE EXECUTE ON FUNCTION public.generate_org_slug(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agency_settings_set_org_slug() FROM PUBLIC, anon, authenticated;
