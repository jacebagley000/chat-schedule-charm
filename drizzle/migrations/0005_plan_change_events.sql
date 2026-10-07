CREATE TABLE public.plan_change_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paddle_subscription_id text NOT NULL,
  from_product_id text,
  from_price_id text,
  to_product_id text NOT NULL,
  to_price_id text NOT NULL,
  environment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plan_change_events TO authenticated;
GRANT ALL ON public.plan_change_events TO service_role;

ALTER TABLE public.plan_change_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read plan change events"
ON public.plan_change_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_plan_upgrades(_since timestamptz, _env text)
RETURNS TABLE(
  user_id uuid,
  changed_at timestamptz,
  email text,
  business_name text,
  from_product_id text,
  to_product_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.user_id,
         e.created_at AS changed_at,
         u.email,
         u.raw_user_meta_data->>'business_name' AS business_name,
         e.from_product_id,
         e.to_product_id
  FROM public.plan_change_events e
  JOIN auth.users u ON u.id = e.user_id
  WHERE e.created_at >= _since
    AND e.environment = _env
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY e.created_at DESC
$$;

REVOKE EXECUTE ON FUNCTION public.admin_plan_upgrades(timestamptz, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_plan_upgrades(timestamptz, text) TO authenticated;