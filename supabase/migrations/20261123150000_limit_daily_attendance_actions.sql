-- Enforce one check-in and one check-out per employee per Baghdad calendar day.
-- Checks are performed server-side under an employee-scoped advisory lock.

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

  -- Check every row for this employee/day, not just the latest row.
  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE employee_id = v_employee_id
      AND attendance_date = v_today
      AND check_in IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Check-in has already been recorded for today';
  END IF;

  SELECT * INTO v_row
  FROM public.attendance
  WHERE employee_id = v_employee_id AND attendance_date = v_today
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.attendance
    SET check_in = NOW(), status = 'present'
    WHERE id = v_row.id
    RETURNING * INTO v_row;
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

  -- A second check-out is forbidden even if duplicate attendance rows exist.
  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE employee_id = v_employee_id
      AND attendance_date = v_today
      AND check_out IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Check-out has already been recorded for today';
  END IF;

  UPDATE public.attendance
  SET check_out = NOW()
  WHERE id = (
    SELECT id
    FROM public.attendance
    WHERE employee_id = v_employee_id
      AND attendance_date = v_today
      AND check_in IS NOT NULL
      AND check_out IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE
  )
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No open check-in exists for today';
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.employee_check_in(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.employee_check_out(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employee_check_in(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_check_out(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
