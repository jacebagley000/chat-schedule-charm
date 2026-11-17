CREATE OR REPLACE FUNCTION public.guard_business_membership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b uuid; actor uuid := auth.uid(); old_owner boolean := false; new_owner boolean := false;
BEGIN
 b := CASE WHEN TG_OP='DELETE' THEN OLD.business_id ELSE NEW.business_id END;
 PERFORM 1 FROM public.businesses WHERE id=b FOR UPDATE;
 IF TG_OP<>'INSERT' THEN old_owner := OLD.role='owner'; END IF;
 IF TG_OP<>'DELETE' THEN new_owner := NEW.role='owner'; END IF;
 IF TG_OP='UPDATE' AND (NEW.business_id<>OLD.business_id OR NEW.user_id<>OLD.user_id) THEN RAISE EXCEPTION 'Membership identity cannot be changed' USING ERRCODE='42501'; END IF;
 IF actor IS NOT NULL AND (old_owner OR new_owner) AND NOT public.has_business_role(actor,b,ARRAY['owner']::public.business_role[]) THEN
  IF NOT (TG_OP='INSERT' AND new_owner AND EXISTS(SELECT 1 FROM public.businesses WHERE id=b AND created_by=actor) AND NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=b)) THEN RAISE EXCEPTION 'Only owners can manage ownership' USING ERRCODE='42501'; END IF;
 END IF;
 IF old_owner AND (TG_OP='DELETE' OR NOT new_owner) AND EXISTS(SELECT 1 FROM public.businesses WHERE id=b) AND NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=b AND role='owner' AND id<>OLD.id) THEN RAISE EXCEPTION 'The business must retain an owner' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER guard_business_membership BEFORE INSERT OR UPDATE OR DELETE ON public.business_members FOR EACH ROW EXECUTE FUNCTION public.guard_business_membership();
CREATE OR REPLACE FUNCTION public.guard_owner_invitation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.role='owner' AND auth.uid() IS NOT NULL AND NOT public.has_business_role(auth.uid(),NEW.business_id,ARRAY['owner']::public.business_role[]) THEN RAISE EXCEPTION 'Only owners may invite owners' USING ERRCODE='42501'; END IF; RETURN NEW; END $$;
CREATE TRIGGER guard_owner_invitation BEFORE INSERT OR UPDATE ON public.business_invitations FOR EACH ROW EXECUTE FUNCTION public.guard_owner_invitation();
CREATE OR REPLACE FUNCTION public.resend_business_invitation(_invitation_id uuid) RETURNS TABLE(id uuid,token text,expires_at timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b uuid; r public.business_role; s text;
BEGIN
 SELECT i.business_id,i.role,i.status INTO b,r,s FROM public.business_invitations i WHERE i.id=_invitation_id FOR UPDATE;
 IF b IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
 IF auth.uid() IS NULL OR NOT public.has_business_role(auth.uid(),b,ARRAY['owner','admin']::public.business_role[]) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF s='accepted' THEN RAISE EXCEPTION 'Accepted invitations cannot be resent'; END IF;
 IF r='owner' AND NOT public.has_business_role(auth.uid(),b,ARRAY['owner']::public.business_role[]) THEN RAISE EXCEPTION 'Only owners may resend owner invitations' USING ERRCODE='42501'; END IF;
 UPDATE public.business_invitations i SET token=encode(gen_random_bytes(24),'hex'), expires_at=now()+interval '7 days',status='pending',last_sent_at=now(),send_count=i.send_count+1,updated_at=now() WHERE i.id=_invitation_id;
 RETURN QUERY SELECT i.id,i.token,i.expires_at FROM public.business_invitations i WHERE i.id=_invitation_id;
END $$;
REVOKE ALL ON FUNCTION public.resend_business_invitation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resend_business_invitation(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.guard_appointment_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.ends_at<=NEW.starts_at THEN RAISE EXCEPTION 'Appointment end must follow start' USING ERRCODE='22023'; END IF;
 IF NEW.staff_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.staff WHERE id=NEW.staff_id AND business_id=NEW.business_id) THEN RAISE EXCEPTION 'Staff belongs to another business' USING ERRCODE='23514'; END IF;
 IF NEW.service_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.services WHERE id=NEW.service_id AND business_id=NEW.business_id) THEN RAISE EXCEPTION 'Service belongs to another business' USING ERRCODE='23514'; END IF;
 IF NEW.customer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.customers WHERE id=NEW.customer_id AND business_id=NEW.business_id) THEN RAISE EXCEPTION 'Customer belongs to another business' USING ERRCODE='23514'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER guard_appointment_integrity BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_integrity();
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.appointments ADD CONSTRAINT staff_booking_exclusion EXCLUDE USING gist (business_id WITH =,staff_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE (staff_id IS NOT NULL AND status NOT IN ('cancelled','no_show'));
