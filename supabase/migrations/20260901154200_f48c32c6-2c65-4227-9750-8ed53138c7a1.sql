CREATE TABLE public.sitemap_submission_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'cron',
  site_url text,
  sitemap_url text not null,
  success boolean not null default false,
  message text
);

GRANT SELECT ON public.sitemap_submission_runs TO authenticated;
GRANT ALL ON public.sitemap_submission_runs TO service_role;

ALTER TABLE public.sitemap_submission_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sitemap submission runs"
ON public.sitemap_submission_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX sitemap_submission_runs_created_at_idx
ON public.sitemap_submission_runs (created_at DESC);