import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook } from "@/lib/paddle.server";
import { synchronizeBilling } from "@/lib/billing-sync.server";
export const Route=createFileRoute("/api/public/payments/webhook")({server:{handlers:{POST:async({request})=>{
 const env=new URL(request.url).searchParams.get("env");
 if(env!=="sandbox"&&env!=="live") return new Response("Invalid environment",{status:400});
 let event; try {event=await verifyWebhook(request,env);} catch {return new Response("Invalid signature",{status:401});}
 try {
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  await synchronizeBilling(supabaseAdmin,env,event);
  return Response.json({received:true});
 } catch(error) {console.error("Billing synchronization failed",error);return new Response("Retry billing update",{status:503});}
}}}});