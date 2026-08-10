REVOKE ALL ON FUNCTION public.prevent_mass_delete_logic() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_mass_delete_logic() TO service_role;
