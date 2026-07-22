
-- Add platform_admin role and restrict platform_settings writes to it.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_admin';
