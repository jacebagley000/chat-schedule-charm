ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_started_at timestamptz, ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz, ADD COLUMN IF NOT EXISTS next_billed_at timestamptz, ADD COLUMN IF NOT EXISTS last_event_at timestamptz;
CREATE TABLE public.billing_checkouts (user_id uuid NOT NULL,environment text NOT NULL CHECK(environment IN ('sandbox','live')),transaction_id text,price_id text NOT NULL,started_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,environment),UNIQUE(transaction_id));
GRANT SELECT ON public.billing_checkouts TO authenticated; GRANT ALL ON public.billing_checkouts TO service_role;
ALTER TABLE public.billing_checkouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY checkout_read_own ON public.billing_checkouts FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.billing_events(event_id text NOT NULL,environment text NOT NULL CHECK(environment IN ('sandbox','live')),occurred_at timestamptz NOT NULL,payload jsonb NOT NULL,processed_at timestamptz,PRIMARY KEY(event_id,environment));
GRANT ALL ON public.billing_events TO service_role; ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.billing_payments(transaction_id text NOT NULL,environment text NOT NULL,user_id uuid NOT NULL,subscription_id text,status text NOT NULL,amount_cents bigint NOT NULL DEFAULT 0,currency text NOT NULL DEFAULT 'USD',occurred_at timestamptz NOT NULL,PRIMARY KEY(transaction_id,environment));
GRANT SELECT ON public.billing_payments TO authenticated; GRANT ALL ON public.billing_payments TO service_role; ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_read_own ON public.billing_payments FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.apply_billing_event(eid text,env text,at_time timestamptz,event_payload jsonb,subscription_data jsonb DEFAULT NULL,payment_data jsonb DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prev public.subscriptions%rowtype; uid uuid; sid text; pid text;
BEGIN
 IF env NOT IN ('sandbox','live') THEN RAISE EXCEPTION 'Invalid billing environment'; END IF;
 INSERT INTO public.billing_events VALUES(eid,env,at_time,event_payload,NULL) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM public.billing_events WHERE event_id=eid AND environment=env AND processed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF subscription_data IS NOT NULL THEN
 sid:=subscription_data->>'paddle_subscription_id'; uid:=(subscription_data->>'user_id')::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended(env||sid,0));
 SELECT * INTO prev FROM public.subscriptions WHERE paddle_subscription_id=sid AND environment=env FOR UPDATE;
 IF prev.last_event_at IS NULL OR prev.last_event_at<at_time THEN
 INSERT INTO public.subscriptions(user_id,paddle_subscription_id,paddle_customer_id,product_id,price_id,status,current_period_start,current_period_end,cancel_at_period_end,environment,trial_started_at,trial_ends_at,next_billed_at,last_event_at)
 VALUES(uid,sid,subscription_data->>'paddle_customer_id',subscription_data->>'product_id',subscription_data->>'price_id',subscription_data->>'status',(subscription_data->>'current_period_start')::timestamptz,(subscription_data->>'current_period_end')::timestamptz,coalesce((subscription_data->>'cancel_at_period_end')::boolean,false),env,(subscription_data->>'trial_started_at')::timestamptz,(subscription_data->>'trial_ends_at')::timestamptz,(subscription_data->>'next_billed_at')::timestamptz,at_time)
 ON CONFLICT(paddle_subscription_id) DO UPDATE SET status=excluded.status,product_id=excluded.product_id,price_id=excluded.price_id,current_period_start=excluded.current_period_start,current_period_end=coalesce(excluded.current_period_end,subscriptions.current_period_end),cancel_at_period_end=excluded.cancel_at_period_end,trial_started_at=coalesce(subscriptions.trial_started_at,excluded.trial_started_at),trial_ends_at=coalesce(subscriptions.trial_ends_at,excluded.trial_ends_at),next_billed_at=excluded.next_billed_at,last_event_at=at_time,updated_at=now() WHERE subscriptions.environment=env AND subscriptions.user_id=uid;
 IF prev.id IS NOT NULL AND prev.price_id<>subscription_data->>'price_id' THEN
 INSERT INTO public.plan_change_events(user_id,paddle_subscription_id,from_product_id,from_price_id,to_product_id,to_price_id,environment,created_at) VALUES(uid,sid,prev.product_id,prev.price_id,subscription_data->>'product_id',subscription_data->>'price_id',env,at_time);
 END IF;
 END IF;
 END IF;
 IF payment_data IS NOT NULL THEN
 INSERT INTO public.billing_payments VALUES(payment_data->>'transaction_id',env,(payment_data->>'user_id')::uuid,payment_data->>'subscription_id',payment_data->>'status',coalesce((payment_data->>'amount_cents')::bigint,0),coalesce(payment_data->>'currency','USD'),at_time)
 ON CONFLICT(transaction_id,environment) DO UPDATE SET status=excluded.status,amount_cents=excluded.amount_cents,occurred_at=excluded.occurred_at WHERE billing_payments.occurred_at<=excluded.occurred_at;
 END IF;
 UPDATE public.billing_events SET processed_at=now() WHERE event_id=eid AND environment=env;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.apply_billing_event(text,text,timestamptz,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.apply_billing_event(text,text,timestamptz,jsonb,jsonb,jsonb) TO service_role;
