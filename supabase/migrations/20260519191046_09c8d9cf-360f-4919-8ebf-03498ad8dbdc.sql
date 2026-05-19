DROP TRIGGER IF EXISTS appointments_prevent_overlap ON public.appointments;
CREATE TRIGGER appointments_prevent_overlap
BEFORE INSERT OR UPDATE OF starts_at, ends_at, staff_id, status, business_id
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_staff_appointment_overlap();