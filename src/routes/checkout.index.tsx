import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { pageMeta, absoluteUrl } from "@/lib/seo";
import { MarketingShell } from "@/components/MarketingShell";
import { PLANS } from "@/content/marketing";
import { useAuth } from "@/hooks/use-auth";
import { usePaddleCheckout } from "@/hooks/use-paddle-checkout";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout/")({
  validateSearch: (search: Record<string, unknown>): { plan?: string } => ({
    ...(typeof search.plan === "string" ? { plan: search.plan } : {}),
  }),
  head: () => ({
    meta: pageMeta({
      title: "Checkout — FrontDesk AI",
      description: "Review your FrontDesk AI plan and pay securely.",
      path: "/checkout",
      noindex: true,
    }),
    links: [{ rel: "canonical", href: absoluteUrl("/checkout") }],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { plan: planId } = Route.useSearch();
  const plan = PLANS.find((p) => p.priceId === planId) ?? PLANS[1];
  const { user } = useAuth();
  const { openCheckout } = usePaddleCheckout();
  const [opening, setOpening] = useState(false);

  const pay = async () => {
    if (!user) return;
    setOpening(true);
    try {
      await openCheckout({
        priceId: plan.priceId,
        customerEmail: user.email ?? undefined,
        customData: { userId: user.id },
        successUrl: `${window.location.origin}/checkout/success`,
      });
    } catch {
      toast.error("Couldn't open secure checkout. Please try again.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <MarketingShell>
      <main className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-[1fr_380px]">
        <section>
          <h1 className="mb-2 font-serif text-5xl">Checkout</h1>
          <p className="mb-8 text-muted-foreground">Pick a plan and start your 14-day free trial. Your card is charged only after the trial ends.</p>
          <div className="space-y-3">
            {PLANS.map((p) => (
              <Link
                key={p.priceId}
                to="/checkout"
                search={{ plan: p.priceId }}
                className={`flex items-center justify-between rounded-2xl border p-5 transition-colors ${p.priceId === plan.priceId ? "border-foreground bg-card" : "border-border hover:border-foreground"}`}
              >
                <div>
                  <p className="font-serif text-xl">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{p.blurb}</p>
                </div>
                <p className="font-serif text-2xl">{p.price}<span className="font-sans text-sm text-muted-foreground">/mo</span></p>
              </Link>
            ))}
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-border bg-card p-8">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Order summary</p>
          <h2 className="mt-2 font-serif text-3xl">{plan.name}</h2>
          <ul className="my-6 space-y-2 text-sm">
            {plan.features.map((f) => <li key={f}>✓ {f}</li>)}
          </ul>
          <div className="flex items-baseline justify-between border-t border-border pt-4">
            <span className="text-muted-foreground">Due today</span>
            <span className="font-serif text-3xl">$0</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Then {plan.price}/mo after 14 days, plus tax. Cancel or change plans any time — changes are prorated.</p>

          {user ? (
            <button
              onClick={pay}
              disabled={opening}
              className="mt-6 w-full rounded-full bg-foreground px-6 py-4 font-medium text-background hover:bg-accent disabled:opacity-60"
            >
              {opening ? "Opening secure checkout…" : "Start 14-day free trial"}
            </button>
          ) : (
            <div className="mt-6 space-y-3">
              <Link
                to="/signup"
                search={{ redirect: `/checkout/start?plan=${plan.priceId}` }}
                className="block w-full rounded-full bg-foreground px-6 py-4 text-center font-medium text-background hover:bg-accent"
              >
                Create account &amp; start trial
              </Link>
              <Link
                to="/login"
                search={{ redirect: `/checkout/start?plan=${plan.priceId}` } as never}
                className="block text-center text-sm text-muted-foreground underline"
              >
                Already have an account? Sign in
              </Link>
            </div>
          )}
          <p className="mt-4 text-center text-xs text-muted-foreground">Payments are processed securely by Paddle.</p>
        </aside>
      </main>
    </MarketingShell>
  );
}
