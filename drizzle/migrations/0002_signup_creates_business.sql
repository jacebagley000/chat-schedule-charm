CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  _biz_name text := nullif(trim(new.raw_user_meta_data->>'business_name'), '');
  _tz text := coalesce(nullif(new.raw_user_meta_data->>'business_timezone', ''), 'America/New_York');
  _slug text;
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;

  if _biz_name is not null then
    if not exists (select 1 from pg_timezone_names where name = _tz) then
      _tz := 'America/New_York';
    end if;
    _slug := left(trim(both '-' from regexp_replace(lower(_biz_name), '[^a-z0-9]+', '-', 'g')), 40)
             || '-' || substr(md5(new.id::text), 1, 4);
    insert into public.businesses (name, slug, industry, phone, timezone, created_by)
    values (left(_biz_name, 120), _slug,
      left(nullif(trim(new.raw_user_meta_data->>'business_industry'), ''), 60),
      left(nullif(trim(new.raw_user_meta_data->>'business_phone'), ''), 40),
      _tz, new.id);
  end if;
  return new;
end;
$function$;