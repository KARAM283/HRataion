-- Enforce one successful check-in and one check-out per employee per Baghdad day.
-- Transaction-scoped advisory locks prevent simultaneous duplicate submissions.

CREATE OR REPLACE FUNCTION public.employee_check_in()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Baghdad')::date;
  v_row public.attendance%ROWTYPE;
BEGIN
  SELECT employee_id INTO v_employee_id
  FROM public.user_profiles
  WHERE user_id = auth.uid()
    AND role = 'employee'
    AND is_active = TRUE;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Active employee profile not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_employee_id::text)::bigint);

  SELECT * INTO v_row
  FROM public.attendance
  WHERE employee_id = v_employee_id
    AND attendance_date = v_today
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_row.check_in IS NOT NULL THEN
      RAISE EXCEPTION 'Check-in has already been recorded for today';
    END IF;

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

CREATE OR REPLACE FUNCTION public.employee_check_out()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_row public.attendance%ROWTYPE;
BEGIN
  SELECT employee_id INTO v_employee_id
  FROM public.user_profiles
  WHERE user_id = auth.uid()
    AND role = 'employee'
    AND is_active = TRUE;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Active employee profile not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_employee_id::text)::bigint);

  UPDATE public.attendance
  SET check_out = NOW()
  WHERE employee_id = v_employee_id
    AND attendance_date = (NOW() AT TIME ZONE 'Asia/Baghdad')::date
    AND check_in IS NOT NULL
    AND check_out IS NULL
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Check-out is already recorded or no open check-in exists for today';
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.employee_check_in() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.employee_check_out() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employee_check_in() TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_check_out() TO authenticated;
