ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS location text;

CREATE INDEX IF NOT EXISTS idx_staff_business_role ON public.staff(business_id, role);
CREATE INDEX IF NOT EXISTS idx_staff_business_location ON public.staff(business_id, location);