ALTER POLICY "Anonymous visitors can submit leads" ON public.leads
WITH CHECK (
  char_length(btrim(name)) BETWEEN 1 AND 100
  AND char_length(email) BETWEEN 3 AND 255
  AND email = btrim(email)
  AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  AND (phone IS NULL OR char_length(phone) <= 50)
  AND (business_name IS NULL OR char_length(business_name) <= 200)
  AND char_length(source_page) BETWEEN 1 AND 500
  AND (notes IS NULL OR char_length(notes) <= 1000)
  AND (utm_source IS NULL OR char_length(utm_source) <= 200)
  AND (utm_medium IS NULL OR char_length(utm_medium) <= 200)
  AND (utm_campaign IS NULL OR char_length(utm_campaign) <= 200)
  AND source IN ('organic', 'social', 'referral', 'direct', 'other')
  AND status = 'new'
  AND follow_up_status = 'not_contacted'::public.lead_follow_up_status
  AND contacted_at IS NULL
);
COMMENT ON POLICY "Anonymous visitors can submit leads" ON public.leads IS 'Public inquiry submissions remain available; validate input bounds and prevent visitors from forging internal follow-up state.';