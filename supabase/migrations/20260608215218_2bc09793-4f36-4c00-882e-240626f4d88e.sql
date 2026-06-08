CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  requested_role text;
  final_role app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);

  requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'owner');
  IF requested_role = 'manager' OR requested_role = 'imobiliaria' THEN
    final_role := 'manager'::app_role;
  ELSE
    final_role := 'owner'::app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, final_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $function$;