-- Index to speed up conflict lookups
create index if not exists idx_appointments_staff_time
  on public.appointments (business_id, staff_id, starts_at, ends_at)
  where staff_id is not null;

-- Trigger function: reject overlapping appointments for the same staff
create or replace function public.prevent_staff_appointment_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conflict_row public.appointments%rowtype;
begin
  -- Only enforce when staff is assigned and appointment is active
  if new.staff_id is null then
    return new;
  end if;

  if new.status in ('cancelled', 'no_show') then
    return new;
  end if;

  if new.ends_at <= new.starts_at then
    raise exception 'Appointment end time must be after start time'
      using errcode = '22023';
  end if;

  select * into conflict_row
  from public.appointments a
  where a.business_id = new.business_id
    and a.staff_id = new.staff_id
    and a.id <> new.id
    and a.status not in ('cancelled', 'no_show')
    and a.starts_at < new.ends_at
    and a.ends_at > new.starts_at
  limit 1;

  if found then
    raise exception 'Time conflict: staff member is already booked from % to %',
      to_char(conflict_row.starts_at, 'HH24:MI'),
      to_char(conflict_row.ends_at, 'HH24:MI')
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_prevent_overlap on public.appointments;
create trigger appointments_prevent_overlap
  before insert or update of starts_at, ends_at, staff_id, status, business_id
  on public.appointments
  for each row
  execute function public.prevent_staff_appointment_overlap();