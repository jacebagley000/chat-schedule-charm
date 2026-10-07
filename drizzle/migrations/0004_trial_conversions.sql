CREATE OR REPLACE FUNCTION public.admin_trial_conversions(_since timestamptz, _env text)
RETURNS TABLE(user_id uuid, started_at timestamptz, business_name text, email text, product_id text, status text, current_period_end timestamptz, cancel_at_period_end boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  SELECT DISTINCT ON (s.user_id) s.user_id, s.created_at, COALESCE(u.raw_user_meta_data->>'business_name',''), u.email::text,
         s.product_id, s.status, s.current_period_end, s.cancel_at_period_end
  FROM public.subscriptions s
  JOIN auth.users u ON u.id = s.user_id
  WHERE s.environment = _env AND s.created_at >= _since
  ORDER BY s.user_id, s.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.admin_trial_conversions(timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_trial_conversions(timestamptz, text) TO authenticated;