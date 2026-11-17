import { gatewayFetch, type PaddleEnv } from "./paddle.server";
export async function synchronizeBilling(admin:any, env:PaddleEnv, event:any) {
 const data=event.data; const sid=data.subscriptionId ?? (event.eventType.startsWith("subscription.") ? data.id : null);
 let subscriptionData:any=null; let paymentData:any=null;
 if(sid) {
  const response=await gatewayFetch(env,`/subscriptions/${sid}`);
  if(!response.ok) throw new Error("Subscription reconciliation failed");
  const {data:s}=await response.json() as any;
  const {data:existing,error}=await admin.from("subscriptions").select("*").eq("paddle_subscription_id",sid).eq("environment",env).maybeSingle();
  if(error) throw error;
  const transactionId=s.transaction_id ?? data.id;
  const {data:binding,error:bindingError}=await admin.from("billing_checkouts").select("user_id").eq("environment",env).eq("transaction_id",transactionId).maybeSingle();
  if(bindingError) throw bindingError;
  const uid=existing?.user_id ?? binding?.user_id;
  if(!uid) throw new Error("Unmapped subscription; reconciliation required");
  const item=s.items?.[0];
  const priceId=item?.price?.import_meta?.external_id; const productId=item?.product?.import_meta?.external_id;
  if(!priceId||!productId) throw new Error("Missing catalog association");
  const trial=item?.trial_dates;
  subscriptionData={user_id:uid,paddle_subscription_id:s.id,paddle_customer_id:s.customer_id,price_id:priceId,product_id:productId,status:s.status,current_period_start:s.current_billing_period?.starts_at,current_period_end:s.current_billing_period?.ends_at,trial_started_at:trial?.starts_at,trial_ends_at:trial?.ends_at,next_billed_at:s.next_billed_at,cancel_at_period_end:s.scheduled_change?.action==="cancel"};
 }
 if(event.eventType.startsWith("transaction.")) {
  const {data:binding,error}=await admin.from("billing_checkouts").select("user_id").eq("environment",env).eq("transaction_id",data.id).maybeSingle();
  if(error) throw error;
  const uid=subscriptionData?.user_id ?? binding?.user_id;
  if(!uid) throw new Error("Unmapped payment");
  paymentData={user_id:uid,transaction_id:data.id,subscription_id:sid,status:event.eventType==="transaction.completed" ? "completed":"failed",amount_cents:Number(data.details?.totals?.grandTotal ?? data.details?.totals?.grand_total ?? 0),currency:data.currencyCode ?? data.currency_code};
 }
 const {error}=await admin.rpc("apply_billing_event",{eid:event.eventId,env,at_time:event.occurredAt,event_payload:{type:event.eventType},subscription_data:subscriptionData,payment_data:paymentData});
 if(error) throw error;
}