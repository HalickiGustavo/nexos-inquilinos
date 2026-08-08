-- Remove duplicatas mantendo o convite mais recente
DELETE FROM public.landlord_invites a
USING public.landlord_invites b
WHERE a.id < b.id
  AND a.email = b.email;

-- Agora adiciona a restrição de unicidade
ALTER TABLE public.landlord_invites ADD CONSTRAINT landlord_invites_email_key UNIQUE (email);