ALTER POLICY "anyone can record funnel events" ON public.booking_funnel_events
WITH CHECK (
  event IN ('view', 'click_calendly', 'click_home')
  AND char_length(btrim(visit_id)) BETWEEN 1 AND 128
  AND (booking_status IS NULL OR char_length(booking_status) <= 32)
);
ALTER POLICY "anyone can record trial steps" ON public.trial_funnel_events
WITH CHECK (
  event IN ('view', 'click_start')
  AND char_length(btrim(visit_id)) BETWEEN 1 AND 128
  AND (plan IS NULL OR char_length(plan) <= 64)
);
COMMENT ON POLICY "anyone can record funnel events" ON public.booking_funnel_events IS 'Preserve anonymous and authenticated visitor tracking; accept only known booking steps and bounded payloads.';
COMMENT ON POLICY "anyone can record trial steps" ON public.trial_funnel_events IS 'Preserve anonymous and authenticated visitor tracking; accept only known trial steps and bounded payloads.';