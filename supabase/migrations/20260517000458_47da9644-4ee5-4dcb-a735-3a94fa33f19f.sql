
-- Fix search_path on the non-definer trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Restrict SECURITY DEFINER helpers to authenticated users
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_business() from public, anon, authenticated;

revoke execute on function public.is_business_member(uuid, uuid) from public, anon;
grant execute on function public.is_business_member(uuid, uuid) to authenticated;

revoke execute on function public.has_business_role(uuid, uuid, public.business_role[]) from public, anon;
grant execute on function public.has_business_role(uuid, uuid, public.business_role[]) to authenticated;
