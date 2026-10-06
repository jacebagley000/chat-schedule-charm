ALTER TABLE public.leads
  ADD COLUMN source text NOT NULL DEFAULT 'organic';

ALTER TABLE public.leads
  ADD CONSTRAINT leads_source_check
  CHECK (source IN ('organic', 'social', 'referral', 'direct', 'other'));

-- Backfill existing rows from their UTM data
UPDATE public.leads SET source = 'social'
WHERE lower(coalesce(utm_source, '')) IN ('facebook', 'instagram', 'twitter', 'x', 'linkedin', 'tiktok', 'youtube', 'meta', 'fb', 'ig')
   OR lower(coalesce(utm_medium, '')) IN ('social', 'paid_social', 'social-paid');

UPDATE public.leads SET source = 'referral'
WHERE source = 'organic'
  AND (lower(coalesce(utm_medium, '')) IN ('referral', 'affiliate', 'partner')
   OR lower(coalesce(utm_source, '')) IN ('referral', 'partner', 'affiliate'));

UPDATE public.leads SET source = 'direct'
WHERE source = 'organic'
  AND lower(coalesce(utm_source, '')) = 'direct';

COMMENT ON COLUMN public.leads.source IS 'Acquisition channel: organic, social, referral, direct, or other. Derived from UTM params at submission.';