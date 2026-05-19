-- Enums
create type public.scheduling_request_status as enum ('new', 'reviewed', 'scheduled', 'dismissed');

-- Table
create table public.scheduling_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  channel public.conversation_channel not null,
  status public.scheduling_request_status not null default 'new',
  raw_text text,
  external_sender_id text,
  external_sender_name text,
  ai_is_booking boolean,
  ai_confidence numeric,
  ai_service_hint text,
  ai_requested_at timestamptz,
  ai_party_size integer,
  ai_notes text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scheduling_requests_business_status_idx
  on public.scheduling_requests (business_id, status, created_at desc);

create index scheduling_requests_conversation_idx
  on public.scheduling_requests (conversation_id);

-- RLS
alter table public.scheduling_requests enable row level security;

create policy "Members can view scheduling requests"
  on public.scheduling_requests for select
  using (public.is_business_member(auth.uid(), business_id));

create policy "Members can manage scheduling requests"
  on public.scheduling_requests for all
  using (public.is_business_member(auth.uid(), business_id))
  with check (public.is_business_member(auth.uid(), business_id));

-- updated_at trigger
create trigger set_scheduling_requests_updated_at
  before update on public.scheduling_requests
  for each row execute function public.set_updated_at();