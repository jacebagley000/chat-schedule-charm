import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { billingInput,validatePrice } from "./billing-rules";
import { gatewayFetch,getPaddleClient } from "./paddle.server";
import { z } from "zod";
export const prepareCheckout=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(billingInput).handler(async({data,context})=>{
 const {data:subs,error}=await context.supabase.from("subscriptions").select("*").eq("user_id",context.userId).eq("environment",data.environment);
 if(error) throw error;
 if(subs?.some(s=>["active","trialing","past_due","paused"].includes(s.status))) throw new Error("You already have a subscription. Manage your plan from the customer portal.");
 if(subs?.length) throw new Error("Returning-customer billing requires assistance to avoid another introductory trial. Open billing management.");
 const res=await gatewayFetch(data.environment,`/prices?external_id=${data.priceId}`); if(!res.ok) throw new Error("Unable to load plan");
 const json=await res.json() as any; if(json.data?.length!==1) throw new Error("Ambiguous plan");
 const price=validatePrice(json.data[0],data.priceId);
 const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
 const {data:existing}=await supabaseAdmin.from("billing_checkouts").select("*").eq("user_id",context.userId).eq("environment",data.environment).maybeSingle();
 if(existing?.transaction_id) {
  if(existing.price_id!==data.priceId) throw new Error("A checkout is already in progress for another plan. Complete it before starting another.");
  return {transactionId:existing.transaction_id};
 }
 const {error:lockError}=await supabaseAdmin.from("billing_checkouts").insert({user_id:context.userId,environment:data.environment,price_id:data.priceId});
 if(lockError) throw new Error("Checkout is already being prepared. Please wait and retry.");
 try {
  const response=await gatewayFetch(data.environment,"/transactions",{method:"POST",body:JSON.stringify({items:[{price_id:price,quantity:1}],collection_mode:"automatic",custom_data:{userId:context.userId}})});
  if(!response.ok) throw new Error("Unable to prepare payment"); const result=await response.json() as any;
  const {error:updateError}=await supabaseAdmin.from("billing_checkouts").update({transaction_id:result.data.id}).eq("user_id",context.userId).eq("environment",data.environment); if(updateError) throw updateError;
  return {transactionId:result.data.id as string};
 } catch(error) {await supabaseAdmin.from("billing_checkouts").delete().eq("user_id",context.userId).eq("environment",data.environment).is("transaction_id",null);throw error;}
});
export const billingPortal=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(z.object({environment:z.enum(["sandbox","live"])})).handler(async({data,context})=>{
 const {data:rows,error}=await context.supabase.from("subscriptions").select("*").eq("user_id",context.userId).eq("environment",data.environment).order("created_at",{ascending:false}); if(error) throw error;
 const sub=rows?.[0]; if(!sub) throw new Error("No billing account yet");
 const portal=await getPaddleClient(data.environment).customerPortalSessions.create(sub.paddle_customer_id,[sub.paddle_subscription_id]);
 return {url:portal.urls.general.overview};
});