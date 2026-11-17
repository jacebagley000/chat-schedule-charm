import { createServerFn } from "@tanstack/react-start";
import { gatewayFetch, type PaddleEnv } from "@/lib/paddle.server";
import { billingInput, validatePrice } from "@/lib/billing-rules";

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator(billingInput)
  .handler(async ({ data }) => {
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    if (!response.ok) throw new Error("Unable to resolve plan");
    const result = (await response.json()) as { data?: Array<any> };
    if (result.data?.length !== 1) throw new Error("Plan not found or ambiguous");
    return validatePrice(result.data[0],data.priceId);
  });
