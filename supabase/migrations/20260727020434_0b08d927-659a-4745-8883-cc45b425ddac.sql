CREATE OR REPLACE FUNCTION public.is_business_member(_user_id uuid, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  select exists (
    select 1 from public.business_members
    where user_id = _user_id and business_id = _business_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_business_role(_user_id uuid, _business_id uuid, _roles business_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  select exists (
    select 1 from public.business_members
    where user_id = _user_id
      and business_id = _business_id
      and role = any(_roles)
  );
$$;