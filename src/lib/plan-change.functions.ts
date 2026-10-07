import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayFetch, type PaddleEnv } from "@/lib/paddle.server";

const ALLOWED = ["soloist_monthly", "professional_monthly", "multi_location_monthly"] as const;

type Input = { priceId: string; environment: PaddleEnv };

function validate(data: Input): Input {
  if (!ALLOWED.includes(data.priceId as (typeof ALLOWED)[number])) throw new Error("Unknown plan");
  if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Bad environment");
  return data;
}

async function loadContext(
  supabase: { from: (t: string) => any },
  userId: string,
  data: Input,
) {
  const { data: sub, error } = await supabase
    .from("subscriptions")
    .select("paddle_subscription_id, price_id, status")
    .eq("user_id", userId)
    .eq("environment", data.environment)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sub || !["active", "trialing", "past_due"].includes(sub.status)) {
    throw new Error("No active plan to change. Start a trial from checkout instead.");
  }
  if (sub.price_id === data.priceId) throw new Error("You're already on this plan.");

  const priceRes = await gatewayFetch(
    data.environment,
    `/prices?external_id=${encodeURIComponent(data.priceId)}`,
  );
  if (!priceRes.ok) throw new Error(`Couldn't find that plan [${priceRes.status}]`);
  const priceJson = (await priceRes.json()) as { data?: Array<{ id: string }> };
  const paddlePriceId = priceJson.data?.[0]?.id;
  if (!paddlePriceId) throw new Error("Plan not found");

  const body = JSON.stringify({
    items: [{ price_id: paddlePriceId, quantity: 1 }],
    // Trials aren't billed yet; active plans pay the prorated difference now.
    proration_billing_mode: sub.status === "trialing" ? "do_not_bill" : "prorated_immediately",
  });
  return { sub, body };
}

export const previewPlanChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { sub, body } = await loadContext(context.supabase as any, context.userId, data);
    const res = await gatewayFetch(
      data.environment,
      `/subscriptions/${sub.paddle_subscription_id}/preview`,
      { method: "PATCH", body },
    );
    if (!res.ok) {
      const text = await res.text();
      console.error(`Paddle preview failed [${res.status}]: ${text}`);
      throw new Error(`Couldn't preview the change [${res.status}]`);
    }
    const json = (await res.json()) as {
      data?: {
        currency_code?: string;
        immediate_transaction?: { details?: { totals?: { grand_total?: string } } } | null;
        next_transaction?: { billed_at?: string; details?: { totals?: { grand_total?: string } } } | null;
      };
    };
    const d = json.data ?? {};
    return {
      trialing: sub.status === "trialing",
      currency: d.currency_code ?? "USD",
      dueNowCents: Number(d.immediate_transaction?.details?.totals?.grand_total ?? 0),
      nextAmountCents: Number(d.next_transaction?.details?.totals?.grand_total ?? 0),
      nextBilledAt: d.next_transaction?.billed_at ?? null,
    };
  });

export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { sub, body } = await loadContext(context.supabase as any, context.userId, data);
    const res = await gatewayFetch(
      data.environment,
      `/subscriptions/${sub.paddle_subscription_id}`,
      { method: "PATCH", body },
    );
    if (!res.ok) {
      const text = await res.text();
      console.error(`Paddle plan change failed [${res.status}]: ${text}`);
      throw new Error(`Couldn't change your plan [${res.status}]. Your card may need updating.`);
    }
    return { ok: true };
  });
