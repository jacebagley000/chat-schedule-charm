-- Trigger / internal-only SECURITY DEFINER functions: no direct API caller needs EXECUTE.
-- Triggers fire regardless of EXECUTE grants, so revoking is safe.
REVOKE ALL ON FUNCTION public.prevent_staff_appointment_overlap()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at()                              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user()                             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_business()                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_started_appointment_delete()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_appointments()                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_scheduling_requests()                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_messages()                              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_business_members()                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_audit(uuid, text, audit_entity_type, uuid, text, text, jsonb, jsonb)
                                                                            FROM PUBLIC, anon, authenticated;

-- Client-callable RPCs: authenticated users only, never anon.
REVOKE ALL ON FUNCTION public.create_business_invitation(uuid, text, business_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_business_invitation(uuid, text, business_role) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_business_invitation(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.revoke_business_invitation(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.resend_business_invitation(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.resend_business_invitation(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_business_invitation(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_business_invitation(text) TO authenticated;

REVOKE ALL ON FUNCTION public.add_business_member_by_email(uuid, text, business_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.add_business_member_by_email(uuid, text, business_role) TO authenticated;

REVOKE ALL ON FUNCTION public.list_business_members(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.list_business_members(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.list_business_invitations(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.list_business_invitations(uuid) TO authenticated;

-- RLS helper functions are referenced inside policies evaluated as the querying role,
-- so authenticated users must retain EXECUTE. anon does not query these tables.
REVOKE ALL ON FUNCTION public.is_business_member(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_business_member(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.has_business_role(uuid, uuid, business_role[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_business_role(uuid, uuid, business_role[]) TO authenticated;