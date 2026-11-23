-- Allow each administrator account to change its own password exactly once.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS password_change_used BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.user_profiles.password_change_used IS
  'One-time self-service password change lock for administrator accounts.';
