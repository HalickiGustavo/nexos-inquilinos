ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS efi_account_number text;

ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS agency_efi_account_number text,
  ADD COLUMN IF NOT EXISTS agency_document text;