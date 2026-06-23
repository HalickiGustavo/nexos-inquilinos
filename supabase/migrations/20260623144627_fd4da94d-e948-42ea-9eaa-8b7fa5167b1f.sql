
CREATE OR REPLACE FUNCTION public.accept_landlord_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.landlord_invites%ROWTYPE;
  v_norm_doc text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_invite
  FROM public.landlord_invites
  WHERE invite_token = _token AND status = 'pendente'
  FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_used_token';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'landlord'::app_role)
  ON CONFLICT DO NOTHING;

  UPDATE public.landlord_invites
     SET status = 'aceito', accepted_user_id = auth.uid(), accepted_at = now()
   WHERE id = v_invite.id;

  v_norm_doc := regexp_replace(coalesce(v_invite.document, ''), '\D', '', 'g');

  IF length(v_norm_doc) >= 11 THEN
    UPDATE public.properties p
       SET landlord_id = auth.uid()
     WHERE p.user_id = v_invite.manager_user_id
       AND p.landlord_id IS NULL
       AND coalesce(p.notes, '') LIKE '%' || v_norm_doc || '%';
  END IF;

  RETURN v_invite.id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_landlord_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_landlord_invite(text) TO authenticated;
