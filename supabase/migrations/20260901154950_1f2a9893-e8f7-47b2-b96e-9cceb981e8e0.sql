CREATE TABLE public.cron_secrets (
  name text primary key,
  secret text not null,
  created_at timestamptz not null default now()
);

GRANT ALL ON public.cron_secrets TO service_role;

ALTER TABLE public.cron_secrets ENABLE ROW LEVEL SECURITY;

INSERT INTO public.cron_secrets (name, secret)
VALUES ('sitemap_daily', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;