
-- 1. Extend audit entity type to include business_member
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'business_member';

-- 2. Trigger function to log member changes
CREATE OR REPLACE FUNCTION public.audit_business_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _action text;
  _summary text;
  _changes jsonb;
  _email text;
  _name text;
  _target_uid uuid;
  _biz uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _target_uid := OLD.user_id;
    _biz := OLD.business_id;
  ELSE
    _target_uid := NEW.user_id;
    _biz := NEW.business_id;
  END IF;

  SELECT u.email::text, p.full_name
    INTO _email, _name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = _target_uid;

  IF TG_OP = 'INSERT' THEN
    _action := 'member_invited';
    _summary := 'Added ' || COALESCE(_name, _email, _target_uid::text) || ' as ' || NEW.role::text;
    PERFORM public.log_audit(
      _biz, _action, 'business_member'::public.audit_entity_type, NEW.id, 'internal',
      _summary, NULL,
      jsonb_build_object('user_id', NEW.user_id, 'email', _email, 'role', NEW.role));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      _changes := jsonb_build_object('role', jsonb_build_object('old', OLD.role, 'new', NEW.role));
      _summary := 'Role changed for ' || COALESCE(_name, _email, _target_uid::text) ||
                  ': ' || OLD.role::text || ' → ' || NEW.role::text;
      PERFORM public.log_audit(
        _biz, 'member_role_changed', 'business_member'::public.audit_entity_type, NEW.id, 'internal',
        _summary, _changes,
        jsonb_build_object('user_id', NEW.user_id, 'email', _email));
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    _summary := 'Removed ' || COALESCE(_name, _email, _target_uid::text) ||
                ' (was ' || OLD.role::text || ')';
    PERFORM public.log_audit(
      _biz, 'member_removed', 'business_member'::public.audit_entity_type, OLD.id, 'internal',
      _summary, NULL,
      jsonb_build_object('user_id', OLD.user_id, 'email', _email, 'role', OLD.role));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- 3. Attach triggers
DROP TRIGGER IF EXISTS trg_audit_business_members_ins ON public.business_members;
CREATE TRIGGER trg_audit_business_members_ins
AFTER INSERT ON public.business_members
FOR EACH ROW EXECUTE FUNCTION public.audit_business_members();

DROP TRIGGER IF EXISTS trg_audit_business_members_upd ON public.business_members;
CREATE TRIGGER trg_audit_business_members_upd
AFTER UPDATE ON public.business_members
FOR EACH ROW EXECUTE FUNCTION public.audit_business_members();

DROP TRIGGER IF EXISTS trg_audit_business_members_del ON public.business_members;
CREATE TRIGGER trg_audit_business_members_del
AFTER DELETE ON public.business_members
FOR EACH ROW EXECUTE FUNCTION public.audit_business_members();
