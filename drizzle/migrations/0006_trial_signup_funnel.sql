CREATE TABLE public.trial_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL CHECK (event IN ('view','click_start')),
  visit_id text NOT NULL CHECK (length(visit_id) <= 64),
  plan text CHECK (length(plan) <= 64)
);
GRANT INSERT ON public.trial_funnel_events TO anon, authenticated;
GRANT SELECT ON public.trial_funnel_events TO authenticated;
GRANT ALL ON public.trial_funnel_events TO service_role;
ALTER TABLE public.trial_funnel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can record trial steps" ON public.trial_funnel_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admins read trial steps" ON public.trial_funnel_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_trial_signup_funnel(_since timestamptz, _env text)
RETURNS TABLE(visitors bigint, clicked bigint, signed_up bigint, confirmed bigint, trial_started bigint, paying bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  WITH u AS (
    SELECT id, email_confirmed_at FROM auth.users
    WHERE created_at >= _since AND coalesce(raw_user_meta_data->>'trial_visit_id','') <> ''
  ), s AS (
    SELECT DISTINCT ON (sub.user_id) sub.user_id, sub.status FROM public.subscriptions sub
    JOIN u ON u.id = sub.user_id WHERE sub.environment = _env
    ORDER BY sub.user_id, sub.created_at DESC
  )
  SELECT
    (SELECT count(DISTINCT visit_id) FROM public.trial_funnel_events WHERE event='view' AND created_at >= _since),
    (SELECT count(DISTINCT visit_id) FROM public.trial_funnel_events WHERE event='click_start' AND created_at >= _since),
    (SELECT count(*) FROM u),
    (SELECT count(*) FROM u WHERE email_confirmed_at IS NOT NULL),
    (SELECT count(*) FROM s),
    (SELECT count(*) FROM s WHERE status IN ('active','past_due'));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_trial_signup_funnel(timestamptz, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_trial_signup_funnel(timestamptz, text) TO authenticated;