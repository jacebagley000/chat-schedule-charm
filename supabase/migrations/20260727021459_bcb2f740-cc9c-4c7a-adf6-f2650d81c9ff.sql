
-- Enums
DO $$ BEGIN
  CREATE TYPE public.audit_actor_type AS ENUM ('user','webhook','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_entity_type AS ENUM ('appointment','scheduling_request','conversation','message');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type public.audit_actor_type NOT NULL DEFAULT 'system',
  actor_label text,
  action text NOT NULL,
  entity_type public.audit_entity_type NOT NULL,
  entity_id uuid,
  channel text,
  summary text,
  changes jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_business_created_idx ON public.audit_logs (business_id, created_at DESC);
CREATE INDEX audit_logs_business_entity_idx ON public.audit_logs (business_id, entity_type, entity_id);
CREATE INDEX audit_logs_business_actor_idx ON public.audit_logs (business_id, actor_user_id);

GRANT SELECT, DELETE ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), business_id));

CREATE POLICY "Owners and admins can delete audit logs"
  ON public.audit_logs FOR DELETE TO authenticated
  USING (public.has_business_role(auth.uid(), business_id, ARRAY['owner','admin']::public.business_role[]));

-- Central logger (SECURITY DEFINER so triggers can write past RLS)
CREATE OR REPLACE FUNCTION public.log_audit(
  _business_id uuid,
  _action text,
  _entity_type public.audit_entity_type,
  _entity_id uuid,
  _channel text,
  _summary text,
  _changes jsonb,
  _metadata jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _actor_type public.audit_actor_type;
  _actor_label text;
  _override text;
BEGIN
  IF _business_id IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    _override := current_setting('app.actor_label', true);
  EXCEPTION WHEN OTHERS THEN
    _override := NULL;
  END;

  IF _uid IS NOT NULL THEN
    _actor_type := 'user';
    SELECT COALESCE(p.full_name, u.email::text)
      INTO _actor_label
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.id = u.id
      WHERE u.id = _uid;
  ELSIF _override IS NOT NULL AND _override <> '' THEN
    _actor_type := 'webhook';
    _actor_label := _override;
  ELSE
    _actor_type := 'system';
    _actor_label := 'System';
  END IF;

  INSERT INTO public.audit_logs (
    business_id, actor_user_id, actor_type, actor_label,
    action, entity_type, entity_id, channel, summary, changes, metadata
  ) VALUES (
    _business_id, _uid, _actor_type, _actor_label,
    _action, _entity_type, _entity_id, _channel, _summary, _changes, _metadata
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit(uuid, text, public.audit_entity_type, uuid, text, text, jsonb, jsonb) FROM PUBLIC;

-- Appointments trigger
CREATE OR REPLACE FUNCTION public.audit_appointments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _changes jsonb := '{}'::jsonb;
  _action text;
  _summary text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    _summary := 'Appointment created for ' || to_char(NEW.starts_at, 'YYYY-MM-DD HH24:MI');
    PERFORM public.log_audit(NEW.business_id, _action, 'appointment', NEW.id, 'internal', _summary, NULL,
      jsonb_build_object('status', NEW.status, 'starts_at', NEW.starts_at, 'ends_at', NEW.ends_at,
                         'staff_id', NEW.staff_id, 'customer_id', NEW.customer_id, 'service_id', NEW.service_id));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at THEN
      _changes := _changes || jsonb_build_object(
        'starts_at', jsonb_build_object('old', OLD.starts_at, 'new', NEW.starts_at),
        'ends_at',   jsonb_build_object('old', OLD.ends_at,   'new', NEW.ends_at));
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      _changes := _changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
    END IF;
    IF NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
      _changes := _changes || jsonb_build_object('staff_id', jsonb_build_object('old', OLD.staff_id, 'new', NEW.staff_id));
    END IF;
    IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
      _changes := _changes || jsonb_build_object('customer_id', jsonb_build_object('old', OLD.customer_id, 'new', NEW.customer_id));
    END IF;
    IF NEW.service_id IS DISTINCT FROM OLD.service_id THEN
      _changes := _changes || jsonb_build_object('service_id', jsonb_build_object('old', OLD.service_id, 'new', NEW.service_id));
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      _changes := _changes || jsonb_build_object('notes', jsonb_build_object('old', OLD.notes, 'new', NEW.notes));
    END IF;

    IF _changes = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

    IF _changes ? 'starts_at' OR _changes ? 'ends_at' THEN
      _action := 'rescheduled';
      _summary := 'Rescheduled to ' || to_char(NEW.starts_at, 'YYYY-MM-DD HH24:MI') ||
                  ' (from ' || to_char(OLD.starts_at, 'YYYY-MM-DD HH24:MI') || ')';
    ELSIF _changes ? 'status' THEN
      _action := 'status_changed';
      _summary := 'Status ' || OLD.status || ' → ' || NEW.status;
    ELSE
      _action := 'updated';
      _summary := 'Appointment updated';
    END IF;

    PERFORM public.log_audit(NEW.business_id, _action, 'appointment', NEW.id, 'internal', _summary, _changes, NULL);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit(OLD.business_id, 'deleted', 'appointment', OLD.id, 'internal',
      'Appointment deleted (' || to_char(OLD.starts_at, 'YYYY-MM-DD HH24:MI') || ')',
      NULL,
      jsonb_build_object('status', OLD.status, 'starts_at', OLD.starts_at, 'ends_at', OLD.ends_at,
                         'staff_id', OLD.staff_id, 'customer_id', OLD.customer_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_appointments_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.audit_appointments();

-- Scheduling requests trigger
CREATE OR REPLACE FUNCTION public.audit_scheduling_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel text;
  _changes jsonb := '{}'::jsonb;
BEGIN
  _channel := COALESCE(NEW.channel::text, OLD.channel::text);
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit(NEW.business_id, 'request_created', 'scheduling_request', NEW.id, _channel,
      COALESCE('New ' || _channel || ' request from ' || NEW.external_sender_name, 'New ' || _channel || ' request'),
      NULL,
      jsonb_build_object('status', NEW.status, 'ai_is_booking', NEW.ai_is_booking,
                         'ai_service_hint', NEW.ai_service_hint, 'ai_requested_at', NEW.ai_requested_at));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      _changes := _changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
    END IF;
    IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
      _changes := _changes || jsonb_build_object('customer_id', jsonb_build_object('old', OLD.customer_id, 'new', NEW.customer_id));
    END IF;
    IF _changes = '{}'::jsonb THEN RETURN NEW; END IF;
    PERFORM public.log_audit(NEW.business_id,
      CASE WHEN _changes ? 'status' THEN 'request_status_changed' ELSE 'request_updated' END,
      'scheduling_request', NEW.id, _channel,
      CASE WHEN _changes ? 'status' THEN 'Request status ' || OLD.status || ' → ' || NEW.status ELSE 'Request updated' END,
      _changes, NULL);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_scheduling_requests_trg
  AFTER INSERT OR UPDATE ON public.scheduling_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_scheduling_requests();

-- Messages trigger
CREATE OR REPLACE FUNCTION public.audit_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel text;
  _action text;
  _preview text;
BEGIN
  SELECT c.channel::text INTO _channel FROM public.conversations c WHERE c.id = NEW.conversation_id;
  _action := CASE WHEN NEW.direction::text = 'inbound' THEN 'message_received' ELSE 'message_sent' END;
  _preview := CASE WHEN NEW.body IS NULL THEN '(no text)' ELSE left(NEW.body, 140) END;
  PERFORM public.log_audit(NEW.business_id, _action, 'message', NEW.id, _channel,
    _preview, NULL, jsonb_build_object('sender', NEW.sender, 'direction', NEW.direction));
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_messages_trg
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.audit_messages();
