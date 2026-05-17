
-- =========================================================
-- Enums
-- =========================================================
create type public.business_role as enum ('owner', 'admin', 'staff');
create type public.appointment_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.appointment_source as enum ('phone', 'instagram', 'facebook', 'sms', 'web', 'manual');
create type public.conversation_channel as enum ('phone', 'instagram', 'facebook', 'sms');
create type public.conversation_status as enum ('open', 'needs_human', 'closed');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_sender as enum ('customer', 'agent', 'human');

-- =========================================================
-- Profiles
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =========================================================
-- Businesses
-- =========================================================
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  industry text,
  timezone text not null default 'America/New_York',
  phone text,
  email text,
  address text,
  logo_url text,
  brand_color text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.businesses enable row level security;

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- =========================================================
-- Business members (roles)
-- =========================================================
create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.business_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

alter table public.business_members enable row level security;

create index on public.business_members (user_id);
create index on public.business_members (business_id);

-- =========================================================
-- Security definer helpers (avoid recursive RLS)
-- =========================================================
create or replace function public.is_business_member(_user_id uuid, _business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members
    where user_id = _user_id and business_id = _business_id
  );
$$;

create or replace function public.has_business_role(_user_id uuid, _business_id uuid, _roles public.business_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members
    where user_id = _user_id
      and business_id = _business_id
      and role = any(_roles)
  );
$$;

-- =========================================================
-- Policies: businesses
-- =========================================================
create policy "Members can view their businesses"
  on public.businesses for select
  using (public.is_business_member(auth.uid(), id));

create policy "Authenticated users can create a business"
  on public.businesses for insert
  with check (auth.uid() = created_by);

create policy "Owners and admins can update their business"
  on public.businesses for update
  using (public.has_business_role(auth.uid(), id, array['owner','admin']::public.business_role[]));

create policy "Owners can delete their business"
  on public.businesses for delete
  using (public.has_business_role(auth.uid(), id, array['owner']::public.business_role[]));

-- Auto-create owner membership when a business is created
create or replace function public.handle_new_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.business_members (business_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_business_created
  after insert on public.businesses
  for each row execute function public.handle_new_business();

-- =========================================================
-- Policies: business_members
-- =========================================================
create policy "Members can view memberships of their businesses"
  on public.business_members for select
  using (public.is_business_member(auth.uid(), business_id));

create policy "Owners/admins can add members"
  on public.business_members for insert
  with check (
    public.has_business_role(auth.uid(), business_id, array['owner','admin']::public.business_role[])
    or (
      -- allow the trigger-inserted owner row (same user, owner role, business has no members yet)
      auth.uid() = user_id
      and role = 'owner'
      and not exists (select 1 from public.business_members bm where bm.business_id = business_members.business_id)
    )
  );

create policy "Owners/admins can update memberships"
  on public.business_members for update
  using (public.has_business_role(auth.uid(), business_id, array['owner','admin']::public.business_role[]));

create policy "Owners/admins can remove memberships"
  on public.business_members for delete
  using (public.has_business_role(auth.uid(), business_id, array['owner','admin']::public.business_role[]));

-- =========================================================
-- Staff (bookable resources)
-- =========================================================
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  specialty text,
  color text,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.staff (business_id);
alter table public.staff enable row level security;
create trigger staff_set_updated_at before update on public.staff for each row execute function public.set_updated_at();

create policy "Members can view staff" on public.staff for select
  using (public.is_business_member(auth.uid(), business_id));
create policy "Members can manage staff" on public.staff for all
  using (public.is_business_member(auth.uid(), business_id))
  with check (public.is_business_member(auth.uid(), business_id));

-- =========================================================
-- Services
-- =========================================================
create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null default 30,
  price_cents integer,
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.services (business_id);
alter table public.services enable row level security;
create trigger services_set_updated_at before update on public.services for each row execute function public.set_updated_at();

create policy "Members can view services" on public.services for select
  using (public.is_business_member(auth.uid(), business_id));
create policy "Members can manage services" on public.services for all
  using (public.is_business_member(auth.uid(), business_id))
  with check (public.is_business_member(auth.uid(), business_id));

-- =========================================================
-- Customers
-- =========================================================
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.customers (business_id);
create index on public.customers (business_id, phone);
alter table public.customers enable row level security;
create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();

create policy "Members can view customers" on public.customers for select
  using (public.is_business_member(auth.uid(), business_id));
create policy "Members can manage customers" on public.customers for all
  using (public.is_business_member(auth.uid(), business_id))
  with check (public.is_business_member(auth.uid(), business_id));

-- =========================================================
-- Appointments
-- =========================================================
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'pending',
  source public.appointment_source not null default 'manual',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.appointments (business_id, starts_at);
create index on public.appointments (staff_id, starts_at);
alter table public.appointments enable row level security;
create trigger appointments_set_updated_at before update on public.appointments for each row execute function public.set_updated_at();

create policy "Members can view appointments" on public.appointments for select
  using (public.is_business_member(auth.uid(), business_id));
create policy "Members can manage appointments" on public.appointments for all
  using (public.is_business_member(auth.uid(), business_id))
  with check (public.is_business_member(auth.uid(), business_id));

-- =========================================================
-- Conversations
-- =========================================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  channel public.conversation_channel not null,
  external_id text,
  subject text,
  status public.conversation_status not null default 'open',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.conversations (business_id, last_message_at desc);
create index on public.conversations (business_id, channel);
alter table public.conversations enable row level security;
create trigger conversations_set_updated_at before update on public.conversations for each row execute function public.set_updated_at();

create policy "Members can view conversations" on public.conversations for select
  using (public.is_business_member(auth.uid(), business_id));
create policy "Members can manage conversations" on public.conversations for all
  using (public.is_business_member(auth.uid(), business_id))
  with check (public.is_business_member(auth.uid(), business_id));

-- =========================================================
-- Messages
-- =========================================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  direction public.message_direction not null,
  sender public.message_sender not null,
  body text,
  audio_url text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at);
create index on public.messages (business_id, created_at desc);
alter table public.messages enable row level security;

create policy "Members can view messages" on public.messages for select
  using (public.is_business_member(auth.uid(), business_id));
create policy "Members can manage messages" on public.messages for all
  using (public.is_business_member(auth.uid(), business_id))
  with check (public.is_business_member(auth.uid(), business_id));
