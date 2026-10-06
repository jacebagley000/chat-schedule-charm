CREATE TABLE public.booking_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL CHECK (event IN ('view','click_calendly','click_home')),
  visit_id text NOT NULL CHECK (char_length(visit_id) BETWEEN 8 AND 64),
  booking_status text CHECK (booking_status IS NULL OR char_length(booking_status) <= 32)
);
GRANT INSERT ON public.booking_funnel_events TO anon, authenticated;
GRANT SELECT ON public.booking_funnel_events TO authenticated;
GRANT ALL ON public.booking_funnel_events TO service_role;
ALTER TABLE public.booking_funnel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can record funnel events" ON public.booking_funnel_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admins read funnel events" ON public.booking_funnel_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX booking_funnel_events_created_idx ON public.booking_funnel_events (created_at DESC);