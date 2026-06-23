-- Fix infinite recursion: properties policy "Tenant views rented property"
-- references contracts; contracts/landlord policy references properties;
-- when Postgres evaluates them they keep calling each other.
-- Wrap the tenant check in a SECURITY DEFINER function so contracts isn't
-- queried through RLS during properties policy evaluation.

CREATE OR REPLACE FUNCTION public.is_current_tenant_property(_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contracts c
    WHERE c.property_id = _property_id
      AND c.tenant_id = public.current_tenant_id()
      AND c.active
  )
$$;

DROP POLICY IF EXISTS "Tenant views rented property" ON public.properties;
CREATE POLICY "Tenant views rented property"
  ON public.properties
  FOR SELECT
  TO authenticated
  USING (public.is_current_tenant_property(id));
