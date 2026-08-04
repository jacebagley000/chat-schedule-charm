create type public.app_role as enum ('admin', 'support');

create table public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    role public.app_role not null,
    unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "Authenticated users can read own roles"
on public.user_roles
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create table public.leads (
    id uuid primary key default gen_random_uuid(),
    created_at timestamp with time zone not null default now(),
    name text not null,
    email text not null,
    phone text,
    business_name text,
    preferred_call_time timestamp with time zone,
    source_page text not null,
    notes text,
    status text not null default 'new',
    utm_source text,
    utm_medium text,
    utm_campaign text,
    constraint leads_status_check check (status in ('new', 'contacted', 'scheduled', 'converted', 'closed'))
);

comment on table public.leads is 'Visitors who requested an onboarding call from comparison pages.';

grant insert on public.leads to anon;
grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;

alter table public.leads enable row level security;

create policy "Anonymous visitors can submit leads"
on public.leads
for insert
to anon
with check (true);

create policy "Admins can manage leads"
on public.leads
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));
