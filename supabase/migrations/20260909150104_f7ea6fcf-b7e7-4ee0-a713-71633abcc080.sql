CREATE TABLE public.crawl_alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text,
  enabled boolean NOT NULL DEFAULT false,
  min_interval_minutes integer NOT NULL DEFAULT 60,
  last_alert_at timestamptz,
  last_signature text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crawl_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  subject text NOT NULL,
  failure_count integer NOT NULL DEFAULT 0,
  failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  kind text NOT NULL DEFAULT 'alert',
  ok boolean NOT NULL DEFAULT true,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crawl_alert_settings TO authenticated;
GRANT SELECT, INSERT ON public.crawl_alert_events TO authenticated;
GRANT ALL ON public.crawl_alert_settings TO service_role;
GRANT ALL ON public.crawl_alert_events TO service_role;

ALTER TABLE public.crawl_alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawl_alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage crawl alert settings"
ON public.crawl_alert_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read crawl alert events"
ON public.crawl_alert_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert crawl alert events"
ON public.crawl_alert_events FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_crawl_alert_settings_updated_at
BEFORE UPDATE ON public.crawl_alert_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();