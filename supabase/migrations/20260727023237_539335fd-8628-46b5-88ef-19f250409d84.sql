
-- ============================================================
-- business_invitations table
-- ============================================================

CREATE TABLE public.business_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.business_role NOT NULL DEFAULT 'staff',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  send_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_business_invitations_business ON public.business_invitations(business_id);
CREATE INDEX idx_business_invitations_email ON public.business_invitations(lower(email));
-- Only one live pending invite per (business, email)
CREATE UNIQUE INDEX uniq_business_invitations_pending
  ON public.business_invitations(business_id, lower(email))
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_invitations TO authenticated;
GRANT ALL ON public.business_invitations TO service_role;

ALTER TABLE public.business_invitations ENABLE ROW LEVEL SECURITY;

-- Managers can view invitations for their workspace
CREATE POLICY "Managers view business invitations"
  ON public.business_invitations FOR SELECT
  TO authenticated
  USING (
    public.has_business_role(
      auth.uid(), business_id,
      ARRAY['owner','admin']::public.business_role[]
    )
  );

-- Invitees can view invitations addressed to their email (for the accept flow)
CREATE POLICY "Invitee views own invitations"
  ON public.business_invitations FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

-- Only managers can insert/update/delete via the helper RPCs.
-- We keep policies for those, but the RPCs are SECURITY DEFINER with explicit checks.
CREATE POLICY "Managers manage business invitations"
  ON public.business_invitations FOR ALL
  TO authenticated
  USING (
    public.has_business_role(
      auth.uid(), business_id,
      ARRAY['owner','admin']::public.business_role[]
    )
  )
  WITH CHECK (
    public.has_business_role(
      auth.uid(), business_id,
      ARRAY['owner','admin']::public.business_role[]
    )
  );

CREATE TRIGGER update_business_invitations_updated_at
  BEFORE UPDATE ON public.business_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RPCs
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_business_invitation(
  _business_id uuid,
  _email text,
  _role public.business_role
) RETURNS TABLE(id uuid, token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized text := lower(trim(_email));
  _new_id uuid;
  _new_token text;
  _new_expires timestamptz;
  _existing_user uuid;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_business_role(auth.uid(), _business_id,
                                     ARRAY['owner','admin']::public.business_role[]) THEN
    RAISE EXCEPTION 'Only owners or admins can invite members' USING ERRCODE = '42501';
  END IF;

  IF _normalized IS NULL OR _normalized = '' THEN
    RAISE EXCEPTION 'Email is required' USING ERRCODE = '22023';
  END IF;

  -- If already a member, reject.
  SELECT u.id INTO _existing_user FROM auth.users u
   WHERE lower(u.email) = _normalized LIMIT 1;
  IF _existing_user IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.business_members
                  WHERE business_id = _business_id AND user_id = _existing_user) THEN
    RAISE EXCEPTION 'That email is already a member of this workspace'
      USING ERRCODE = '23505';
  END IF;

  -- Expire any stale pending row for this pair so we can reinsert cleanly.
  UPDATE public.business_invitations
     SET status = 'expired', updated_at = now()
   WHERE business_id = _business_id
     AND lower(email) = _normalized
     AND status = 'pending'
     AND expires_at <= now();

  INSERT INTO public.business_invitations (business_id, email, role, invited_by)
  VALUES (_business_id, _normalized, _role, auth.uid())
  RETURNING business_invitations.id,
            business_invitations.token,
            business_invitations.expires_at
    INTO _new_id, _new_token, _new_expires;

  RETURN QUERY SELECT _new_id, _new_token, _new_expires;
END;
$$;

CREATE OR REPLACE FUNCTION public.resend_business_invitation(_invitation_id uuid)
RETURNS TABLE(id uuid, token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _biz uuid;
  _new_token text;
  _new_expires timestamptz;
BEGIN
  SELECT business_id INTO _biz FROM public.business_invitations WHERE id = _invitation_id;
  IF _biz IS NULL THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NULL
     OR NOT public.has_business_role(auth.uid(), _biz,
                                     ARRAY['owner','admin']::public.business_role[]) THEN
    RAISE EXCEPTION 'Only owners or admins can resend invitations' USING ERRCODE = '42501';
  END IF;

  UPDATE public.business_invitations
     SET token = encode(gen_random_bytes(24), 'hex'),
         expires_at = now() + interval '7 days',
         status = 'pending',
         last_sent_at = now(),
         send_count = send_count + 1,
         accepted_at = NULL,
         updated_at = now()
   WHERE id = _invitation_id
   RETURNING business_invitations.id,
             business_invitations.token,
             business_invitations.expires_at
     INTO _new_token, _new_expires, _new_expires;

  -- Re-select for clean return (the RETURNING assignment above uses multiple values)
  RETURN QUERY
    SELECT i.id, i.token, i.expires_at
      FROM public.business_invitations i
     WHERE i.id = _invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_business_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _biz uuid;
BEGIN
  SELECT business_id INTO _biz FROM public.business_invitations WHERE id = _invitation_id;
  IF _biz IS NULL THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NULL
     OR NOT public.has_business_role(auth.uid(), _biz,
                                     ARRAY['owner','admin']::public.business_role[]) THEN
    RAISE EXCEPTION 'Only owners or admins can revoke invitations' USING ERRCODE = '42501';
  END IF;

  UPDATE public.business_invitations
     SET status = 'revoked', updated_at = now()
   WHERE id = _invitation_id AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.list_business_invitations(_business_id uuid)
RETURNS TABLE(
  id uuid,
  email text,
  role public.business_role,
  status text,
  expires_at timestamptz,
  last_sent_at timestamptz,
  send_count integer,
  created_at timestamptz,
  is_expired boolean,
  invited_by_name text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT i.id, i.email, i.role,
           CASE
             WHEN i.status = 'pending' AND i.expires_at <= now() THEN 'expired'
             ELSE i.status
           END AS status,
           i.expires_at,
           i.last_sent_at,
           i.send_count,
           i.created_at,
           (i.status = 'pending' AND i.expires_at <= now()) AS is_expired,
           COALESCE(p.full_name, u.email::text) AS invited_by_name
      FROM public.business_invitations i
      LEFT JOIN auth.users u ON u.id = i.invited_by
      LEFT JOIN public.profiles p ON p.id = i.invited_by
     WHERE i.business_id = _business_id
       AND i.status IN ('pending','expired')  -- accepted/revoked hidden from active list
     ORDER BY i.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_business_invitation(_token text)
RETURNS TABLE(business_id uuid, business_name text, role public.business_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.business_invitations%rowtype;
  _uid uuid := auth.uid();
  _user_email text;
  _biz_name text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to accept an invitation' USING ERRCODE = '42501';
  END IF;

  SELECT lower(email) INTO _user_email FROM auth.users WHERE id = _uid;

  SELECT * INTO _inv FROM public.business_invitations WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'P0002';
  END IF;

  IF _inv.status = 'accepted' THEN
    RAISE EXCEPTION 'This invitation has already been accepted' USING ERRCODE = 'P0001';
  END IF;
  IF _inv.status = 'revoked' THEN
    RAISE EXCEPTION 'This invitation was revoked' USING ERRCODE = 'P0001';
  END IF;
  IF _inv.status = 'expired' OR _inv.expires_at <= now() THEN
    UPDATE public.business_invitations SET status = 'expired', updated_at = now()
     WHERE id = _inv.id AND status = 'pending';
    RAISE EXCEPTION 'This invitation has expired. Ask an admin to resend it.'
      USING ERRCODE = 'P0001';
  END IF;

  IF lower(_inv.email) <> _user_email THEN
    RAISE EXCEPTION 'This invitation is for a different email address (%). Sign in as that user.',
      _inv.email USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.business_members (business_id, user_id, role)
  VALUES (_inv.business_id, _uid, _inv.role)
  ON CONFLICT (business_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.business_invitations
     SET status = 'accepted', accepted_at = now(), updated_at = now()
   WHERE id = _inv.id;

  SELECT name INTO _biz_name FROM public.businesses WHERE id = _inv.business_id;

  RETURN QUERY SELECT _inv.business_id, _biz_name, _inv.role;
END;
$$;

-- Lock down helper function execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.create_business_invitation(uuid, text, public.business_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resend_business_invitation(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_business_invitation(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_business_invitations(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_business_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_business_invitation(uuid, text, public.business_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resend_business_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_business_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_business_invitations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_business_invitation(text) TO authenticated;
