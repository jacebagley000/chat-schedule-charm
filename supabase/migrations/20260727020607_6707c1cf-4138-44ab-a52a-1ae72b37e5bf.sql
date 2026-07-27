
CREATE OR REPLACE FUNCTION public.list_business_members(_business_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  role public.business_role,
  created_at timestamptz,
  email text,
  full_name text,
  avatar_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Not authorized to view members of this business'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT bm.id, bm.user_id, bm.role, bm.created_at,
           u.email::text, p.full_name, p.avatar_url
    FROM public.business_members bm
    LEFT JOIN public.profiles p ON p.id = bm.user_id
    LEFT JOIN auth.users u ON u.id = bm.user_id
    WHERE bm.business_id = _business_id
    ORDER BY bm.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_business_members(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_business_members(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_business_member_by_email(
  _business_id uuid,
  _email text,
  _role public.business_role
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target_user uuid;
  _new_id uuid;
  _normalized text := lower(trim(_email));
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_business_role(auth.uid(), _business_id,
                                     ARRAY['owner','admin']::public.business_role[]) THEN
    RAISE EXCEPTION 'Only owners or admins can add members'
      USING ERRCODE = '42501';
  END IF;

  IF _normalized IS NULL OR _normalized = '' THEN
    RAISE EXCEPTION 'Email is required' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO _target_user
  FROM auth.users
  WHERE lower(email) = _normalized
  LIMIT 1;

  IF _target_user IS NULL THEN
    RAISE EXCEPTION 'No user found with email %', _normalized
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.business_members (business_id, user_id, role)
  VALUES (_business_id, _target_user, _role)
  ON CONFLICT (business_id, user_id)
    DO UPDATE SET role = EXCLUDED.role
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_business_member_by_email(uuid, text, public.business_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.add_business_member_by_email(uuid, text, public.business_role) TO authenticated;
