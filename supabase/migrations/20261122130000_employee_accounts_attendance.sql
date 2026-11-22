-- Employee login metadata and secure attendance actions.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS login_email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_login_email_unique
  ON public.user_profiles (login_email)
  WHERE login_email IS NOT NULL;

-- Employees may read only their own attendance records.
DROP POLICY IF EXISTS "Employee reads own attendance" ON public.attendance;
CREATE POLICY "Employee reads own attendance"
ON public.attendance
FOR SELECT TO authenticated
USING (
  employee_id = (
    SELECT up.employee_id
    FROM public.user_profiles AS up
    WHERE up.user_id = auth.uid()
      AND up.role = 'employee'
      AND up.is_active = TRUE
  )
);

-- Clock actions run in the database so the employee cannot submit arbitrary timestamps.
CREATE OR REPLACE FUNCTION public.employee_check_in()
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

  SELECT * INTO v_row
  FROM public.attendance
  WHERE employee_id = v_employee_id
    AND attendance_date = CURRENT_DATE
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
    VALUES (v_employee_id, CURRENT_DATE, NOW(), 'present')
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

  UPDATE public.attendance
  SET check_out = NOW()
  WHERE employee_id = v_employee_id
    AND attendance_date = CURRENT_DATE
    AND check_in IS NOT NULL
    AND check_out IS NULL
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No open check-in record was found for today';
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.employee_check_in() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.employee_check_out() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employee_check_in() TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_check_out() TO authenticated;
