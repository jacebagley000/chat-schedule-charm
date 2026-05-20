CREATE OR REPLACE FUNCTION public.prevent_started_appointment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.starts_at <= now() THEN
    IF auth.uid() IS NULL
       OR NOT public.has_business_role(auth.uid(), OLD.business_id, ARRAY['owner','admin']::business_role[]) THEN
      RAISE EXCEPTION 'This appointment has already started. A manager (owner or admin) is required to delete it.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS appointments_prevent_started_delete ON public.appointments;

CREATE TRIGGER appointments_prevent_started_delete
BEFORE DELETE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_started_appointment_delete();