import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";
import { prepareCheckout } from "@/lib/billing.functions";
import { getPaddleEnvironment } from "@/lib/paddle";
import { useServerFn } from "@tanstack/react-start";

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);
  const prepare = useServerFn(prepareCheckout);

  const openCheckout = async (options: {
    priceId: string;
    quantity?: number;
    customerEmail?: string;
    customData?: Record<string, string>;
    successUrl?: string;
  }) => {
    setLoading(true);
    try {
      await initializePaddle();
      const {transactionId} = await prepare({data:{priceId:options.priceId as "soloist_monthly"|"professional_monthly"|"multi_location_monthly",environment:getPaddleEnvironment()}});

      window.Paddle.Checkout.open({
        transactionId,
        settings: {
          displayMode: "overlay",
          successUrl:
            options.successUrl || `${window.location.origin}/checkout/success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
