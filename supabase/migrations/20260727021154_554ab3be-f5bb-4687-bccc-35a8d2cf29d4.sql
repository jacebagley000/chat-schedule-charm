-- Restore SECURITY DEFINER on membership/role helpers to prevent
-- infinite RLS recursion. The business_members SELECT policy calls
-- is_business_member(); if that function runs as INVOKER it re-queries
-- business_members and re-triggers the same policy -> stack overflow.
-- SECURITY DEFINER is the documented Supabase pattern for this exact case.

CREATE OR REPLACE FUNCTION public.is_business_member(_user_id uuid, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE user_id = _user_id AND business_id = _business_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_business_role(_user_id uuid, _business_id uuid, _roles business_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE user_id = _user_id
      AND business_id = _business_id
      AND role = ANY(_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.is_business_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_business_role(uuid, uuid, business_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_business_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_business_role(uuid, uuid, business_role[]) TO authenticated, service_role;