import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/use-paddle-checkout";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout/start")({
  validateSearch: (search: Record<string, unknown>): { plan?: string } => ({
    ...(typeof search.plan === "string" ? { plan: search.plan } : {}),
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/login",
        search: { redirect: `/checkout/start?plan=${search.plan ?? ""}` } as never,
      });
    }
  },
  component: CheckoutStartPage,
  head: () => ({
    meta: [
      { title: "Starting checkout — FrontDesk AI" },
      { name: "description", content: "Redirecting you to secure checkout." },
    ],
  }),
});

function CheckoutStartPage() {
  const { plan } = Route.useSearch();
  const { openCheckout } = usePaddleCheckout();
  const navigate = useNavigate();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      if (!plan) {
        navigate({ to: "/dashboard" });
        return;
      }
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        navigate({ to: "/login", search: { redirect: `/checkout/start?plan=${plan}` } as never });
        return;
      }
      try {
        await openCheckout({
          priceId: plan,
          customerEmail: user.email ?? undefined,
          customData: { userId: user.id },
          successUrl: `${window.location.origin}/checkout/success`,
        });
      } catch (e) {
        toast.error("Couldn't open checkout. Please try again from the pricing page.");
        navigate({ to: "/dashboard" });
      }
    })();
  }, [plan, openCheckout, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="animate-pulse font-serif text-xl mb-2">Opening secure checkout…</h1>
        <p className="text-sm text-muted-foreground">Please complete your purchase in the Paddle window.</p>
      </div>
    </div>
  );
}
