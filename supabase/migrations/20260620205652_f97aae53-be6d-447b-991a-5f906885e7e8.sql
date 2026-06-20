
ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS org_slug text UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_org_slug(_manager_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  base text;
  candidate text;
  attempt int := 0;
BEGIN
  SELECT lower(regexp_replace(coalesce(p.full_name, 'imobiliaria'), '[^a-zA-Z0-9]+', '-', 'g'))
    INTO base
  FROM public.profiles p
  WHERE p.id = _manager_user_id;

  base := trim(both '-' from coalesce(base, 'imobiliaria'));
  IF base IS NULL OR base = '' THEN base := 'imobiliaria'; END IF;
  IF length(base) > 40 THEN base := substring(base from 1 for 40); END IF;

  LOOP
    candidate := base || '-' || substring(md5(random()::text || clock_timestamp()::text) from 1 for 6);
    PERFORM 1 FROM public.agency_settings WHERE org_slug = candidate;
    IF NOT FOUND THEN
      RETURN candidate;
    END IF;
    attempt := attempt + 1;
    IF attempt > 5 THEN
      RETURN base || '-' || substring(md5(random()::text || clock_timestamp()::text || _manager_user_id::text) from 1 for 10);
    END IF;
  END LOOP;
END;
$$;

INSERT INTO public.agency_settings (manager_user_id)
SELECT p.id FROM public.profiles p
LEFT JOIN public.agency_settings a ON a.manager_user_id = p.id
WHERE a.manager_user_id IS NULL;

UPDATE public.agency_settings
   SET org_slug = public.generate_org_slug(manager_user_id)
 WHERE org_slug IS NULL;

CREATE OR REPLACE FUNCTION public.agency_settings_set_org_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_slug IS NULL OR NEW.org_slug = '' THEN
    NEW.org_slug := public.generate_org_slug(NEW.manager_user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agency_settings_org_slug_trg ON public.agency_settings;
CREATE TRIGGER agency_settings_org_slug_trg
  BEFORE INSERT ON public.agency_settings
  FOR EACH ROW EXECUTE FUNCTION public.agency_settings_set_org_slug();
