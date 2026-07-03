
-- Harden EXECUTE grants on SECURITY DEFINER functions.
-- Trigger functions and internal admin helpers must NOT be callable
-- via PostgREST by anon/authenticated. Functions required by RLS or
-- by explicit user actions (invites) keep their execute grants.

-- Revoke default PUBLIC EXECUTE (anon+authenticated inherit from PUBLIC on default Postgres,
-- but Supabase grants EXECUTE to anon/authenticated on functions in `public`).
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_maintenance_changes()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_maintenance_contract_id()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agency_settings_set_org_slug()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_installments_for_contract()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_org_slug(uuid)                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_property_code()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_security_invariants()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_cron_secret(text)                  FROM PUBLIC, anon, authenticated;

-- Keep essential RLS helpers and invite acceptance callable by authenticated users.
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role)                TO authenticated;
GRANT  EXECUTE ON FUNCTION public.current_tenant_id()                     TO authenticated;
GRANT  EXECUTE ON FUNCTION public.current_manager_id()                    TO authenticated;
GRANT  EXECUTE ON FUNCTION public.current_landlord_id()                   TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_current_tenant_property(uuid)        TO authenticated;
GRANT  EXECUTE ON FUNCTION public.accept_landlord_invite(text)            TO authenticated;
GRANT  EXECUTE ON FUNCTION public.accept_manager_invite(text)             TO authenticated;

-- Anon must never call any SECURITY DEFINER helper.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)                FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id()                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_manager_id()                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_landlord_id()                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_current_tenant_property(uuid)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_landlord_invite(text)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_manager_invite(text)             FROM anon;
