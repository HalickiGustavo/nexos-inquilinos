CREATE OR REPLACE FUNCTION public.get_user_id_by_email(email_val text)
RETURNS uuid AS $$
  SELECT id FROM auth.users WHERE email = email_val;
$$ LANGUAGE sql SECURITY DEFINER;
