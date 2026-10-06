CREATE OR REPLACE FUNCTION public.admin_signup_conversions(_since timestamptz)
RETURNS TABLE(user_id uuid, signed_up_at timestamptz, business_name text, industry text, confirmed boolean, product_id text, sub_status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  SELECT u.id, u.created_at,
    u.raw_user_meta_data->>'business_name',
    u.raw_user_meta_data->>'business_industry',
    u.email_confirmed_at IS NOT NULL,
    s.product_id, s.status
  FROM auth.users u
  LEFT JOIN LATERAL (
    SELECT product_id, status FROM public.subscriptions
    WHERE subscriptions.user_id = u.id ORDER BY created_at DESC LIMIT 1
  ) s ON true
  WHERE u.created_at >= _since
    AND coalesce(u.raw_user_meta_data->>'business_name','') <> ''
  ORDER BY u.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.admin_signup_conversions(timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_signup_conversions(timestamptz) TO authenticated;