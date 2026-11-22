-- Seed the standard Blue Line departments without removing existing records.
INSERT INTO public.departments (name)
SELECT v.name
FROM (VALUES ('CRM'),('MEDIA'),('VISA'),('OPERATIONS'),('ACCOUNTANT')) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.departments d WHERE lower(trim(d.name)) = lower(v.name)
);
