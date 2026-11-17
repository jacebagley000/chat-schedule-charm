import { z } from "zod";
export const billingInput = z.object({priceId:z.enum(["soloist_monthly","professional_monthly","multi_location_monthly"]),environment:z.enum(["sandbox","live"])}).strict();
export const amounts: Record<string,number>={soloist_monthly:4900,professional_monthly:9900,multi_location_monthly:19900};
export function validatePrice(price:any, priceId:string) {
  if(price?.status!=="active" || price.unit_price?.amount!==String(amounts[priceId]) || price.unit_price?.currency_code!=="USD" || price.billing_cycle?.interval!=="month" || price.billing_cycle?.frequency!==1 || price.trial_period?.interval!=="day" || price.trial_period?.frequency!==14 || !price.trial_period?.requires_payment_method || price.quantity?.minimum!==1 || price.quantity?.maximum!==1) throw new Error("Plan configuration does not match the advertised terms");
  return price.id as string;
}
export function usableSubscription(sub:any, now=Date.now()):boolean {
 if(!sub) return false;
 const end=sub.status==="trialing" ? sub.trial_ends_at ?? sub.current_period_end : sub.current_period_end;
 if(sub.status==="past_due") return true;
 return ["active","trialing","canceled"].includes(sub.status) && !!end && new Date(end).getTime()>now;
}
export function selectSubscription(rows:any[]) {
 return rows.find(s=>usableSubscription(s)) ?? rows[0] ?? null;
}