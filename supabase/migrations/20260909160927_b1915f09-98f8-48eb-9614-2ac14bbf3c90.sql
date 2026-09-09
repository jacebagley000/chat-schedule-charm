CREATE TABLE public.lead_followup_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  ok boolean NOT NULL,
  error text,
  sent_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.lead_followup_emails TO authenticated;
GRANT ALL ON public.lead_followup_emails TO service_role;

ALTER TABLE public.lead_followup_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view follow-up emails"
  ON public.lead_followup_emails FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert follow-up emails"
  ON public.lead_followup_emails FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_lead_followup_emails_lead ON public.lead_followup_emails (lead_id, created_at DESC);