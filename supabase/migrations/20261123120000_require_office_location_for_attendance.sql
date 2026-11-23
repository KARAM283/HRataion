-- Require a valid device location inside the configured office radius for employee clock actions.
-- Configure the office coordinates in Supabase SQL Editor after applying this migration.

CREATE TABLE IF NOT EXISTS public.attendance_location_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius_meters INTEGER NOT NULL DEFAULT 100 CHECK (radius_meters BETWEEN 20 AND 1000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_office_coordinates CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR
    (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  )
);

INSERT INTO public.attendance_location_settings (singleton, latitude, longitude, radius_meters)
VALUES (TRUE, NULL, NULL, 100)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.attendance_location_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_location_settings FROM PUBLIC, anon, authenticated;

-- Remove direct access to the old no-argument RPCs so clients cannot bypass GPS checks.
REVOKE ALL ON FUNCTION public.employee_check_in() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.employee_check_out() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.employee_check_in(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Baghdad')::date;
  v_row public.attendance%ROWTYPE;
  v_office public.attendance_location_settings%ROWTYPE;
  v_distance DOUBLE PRECISION;
BEGIN
  SELECT * INTO v_office FROM public.attendance_location_settings WHERE singleton = TRUE;
  IF NOT FOUND OR v_office.latitude IS NULL OR v_office.longitude IS NULL THEN
    RAISE EXCEPTION 'Office location is not configured. Contact your HR administrator.';
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude NOT BETWEEN -90 AND 90
     OR p_longitude NOT BETWEEN -180 AND 180
     OR p_accuracy IS NULL OR p_accuracy < 0 OR p_accuracy > 100 THEN
    RAISE EXCEPTION 'Unable to verify your location accurately. Enable precise location and try again.';
  END IF;

  v_distance := 6371000 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(p_latitude - v_office.latitude) / 2), 2) +
    COS(RADIANS(v_office.latitude)) * COS(RADIANS(p_latitude)) *
    POWER(SIN(RADIANS(p_longitude - v_office.longitude) / 2), 2)
  ));

  IF v_distance > v_office.radius_meters THEN
    RAISE EXCEPTION 'You are outside the company attendance area.';
  END IF;

  SELECT employee_id INTO v_employee_id
  FROM public.user_profiles
  WHERE user_id = auth.uid() AND role = 'employee' AND is_active = TRUE;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Active employee profile not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_employee_id::text)::bigint);

  SELECT * INTO v_row
  FROM public.attendance
  WHERE employee_id = v_employee_id AND attendance_date = v_today
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF FOUND THEN
    IF v_row.check_in IS NOT NULL THEN
      RAISE EXCEPTION 'Check-in has already been recorded for today';
    END IF;
    UPDATE public.attendance
    SET check_in = NOW(), status = 'present'
    WHERE id = v_row.id RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.attendance (employee_id, attendance_date, check_in, status)
    VALUES (v_employee_id, v_today, NOW(), 'present')
    RETURNING * INTO v_row;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.employee_check_out(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_row public.attendance%ROWTYPE;
  v_office public.attendance_location_settings%ROWTYPE;
  v_distance DOUBLE PRECISION;
BEGIN
  SELECT * INTO v_office FROM public.attendance_location_settings WHERE singleton = TRUE;
  IF NOT FOUND OR v_office.latitude IS NULL OR v_office.longitude IS NULL THEN
    RAISE EXCEPTION 'Office location is not configured. Contact your HR administrator.';
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude NOT BETWEEN -90 AND 90
     OR p_longitude NOT BETWEEN -180 AND 180
     OR p_accuracy IS NULL OR p_accuracy < 0 OR p_accuracy > 100 THEN
    RAISE EXCEPTION 'Unable to verify your location accurately. Enable precise location and try again.';
  END IF;

  v_distance := 6371000 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(p_latitude - v_office.latitude) / 2), 2) +
    COS(RADIANS(v_office.latitude)) * COS(RADIANS(p_latitude)) *
    POWER(SIN(RADIANS(p_longitude - v_office.longitude) / 2), 2)
  ));

  IF v_distance > v_office.radius_meters THEN
    RAISE EXCEPTION 'You are outside the company attendance area.';
  END IF;

  SELECT employee_id INTO v_employee_id
  FROM public.user_profiles
  WHERE user_id = auth.uid() AND role = 'employee' AND is_active = TRUE;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Active employee profile not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_employee_id::text)::bigint);

  UPDATE public.attendance
  SET check_out = NOW()
  WHERE employee_id = v_employee_id
    AND attendance_date = (NOW() AT TIME ZONE 'Asia/Baghdad')::date
    AND check_in IS NOT NULL AND check_out IS NULL
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Check-out is already recorded or no open check-in exists for today';
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.employee_check_in(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.employee_check_out(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employee_check_in(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_check_out(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
