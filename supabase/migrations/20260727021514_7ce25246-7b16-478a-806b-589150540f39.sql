
REVOKE EXECUTE ON FUNCTION public.log_audit(uuid, text, public.audit_entity_type, uuid, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_appointments() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_scheduling_requests() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_messages() FROM PUBLIC, anon, authenticated;
