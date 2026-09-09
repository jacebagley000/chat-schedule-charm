CREATE TYPE public.lead_follow_up_status AS ENUM ('not_contacted','attempted','contacted','no_response','done');

ALTER TABLE public.leads
  ADD COLUMN follow_up_status public.lead_follow_up_status NOT NULL DEFAULT 'not_contacted',
  ADD COLUMN contacted_at timestamp with time zone;

CREATE POLICY "Admins can update leads"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));