import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { pageMeta, absoluteUrl } from "@/lib/seo";
import { MarketingShell } from "@/components/MarketingShell";
import { PLANS } from "@/content/marketing";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { getPaddleEnvironment } from "@/lib/paddle";
import { previewPlanChange, changePlan } from "@/lib/plan-change.functions";
import { toast } from "sonner";

export const PLAN_SLUGS: Record<string, string> = {
  soloist: "soloist_monthly",
  professional: "professional_monthly",
  "multi-location": "multi_location_monthly",
};

const DETAILS: Record<string, { who: string; highlights: { title: string; body: string }[] }> = {
  soloist_monthly: {
    who: "You run the shop yourself and need someone to catch the calls you can't take.",
    highlights: [
      { title: "Phone answering, 24/7", body: "Every call is picked up, questions answered and bookings made while you work." },
      { title: "Calendar sync", body: "Books straight into your calendar and never double-books a slot." },
      { title: "SMS confirmations", body: "Customers get a text confirming their booking." },
      { title: "Sized for up to 100 calls a month", body: "Busier than that? Professional has unlimited calls." },
    ],
  },
  professional_monthly: {
    who: "You have a team and customers reach you by phone, Instagram and Facebook.",
    highlights: [
      { title: "Unlimited calls and DMs", body: "No monthly ceiling, however busy you get." },
      { title: "Instagram and Facebook replies", body: "The same assistant answers messages and books them in." },
      { title: "Custom knowledge base", body: "Teach it your prices, policies and services in your own words." },
      { title: "Outbound reminders", body: "Automatic reminders cut down on no-shows." },
      { title: "Priority appointment logic", body: "Matches each customer to the right staff member and service." },
    ],
  },
  multi_location_monthly: {
    who: "You own more than one shop and want them all handled from one place.",
    highlights: [
      { title: "Multiple calendars", body: "Each location keeps its own calendar and staff." },
      { title: "Team routing", body: "Customers are sent to the right team and location automatically." },
      { title: "Centralized dashboard", body: "See every shop's bookings in one dashboard." },
      { title: "Dedicated account rep", body: "A real person to help you set up and grow." },
      { title: "Everything in Professional", body: "Unlimited calls, DMs, reminders and more." },
    ],
  },
};

export const Route = createFileRoute("/plans/$planSlug")({
  loader: ({ params }) => {
    const priceId = PLAN_SLUGS[params.planSlug];
    const plan = PLANS.find((p) => p.priceId === priceId);
    if (!plan) throw notFound();
    return { priceId };
  },
  head: ({ loaderData, params }) => {
    const plan = PLANS.find((p) => p.priceId === loaderData?.priceId);
    if (!plan) return { meta: [{ title: "Plan not found — FrontDesk AI" }, { name: "robots", content: "noindex" }] };
    const path = `/plans/${params.planSlug}`;
    return {
      meta: pageMeta({
        title: `${plan.name} plan (${plan.price}/mo) — FrontDesk AI`,
        description: `${plan.blurb} See every feature in the ${plan.name} plan and start a 14-day free trial.`,
        path,
      }),
      links: [{ rel: "canonical", href: absoluteUrl(path) }],
    };
  },
  notFoundComponent: () => (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-serif text-4xl">Plan not found</h1>
        <Link to="/pricing" className="mt-6 inline-block underline">See all plans</Link>
      </main>
    </MarketingShell>
  ),
  component: PlanPage,
});

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function PlanPage() {
  const { priceId } = Route.useLoaderData();
  const plan = PLANS.find((p) => p.priceId === priceId)!;
  const index = PLANS.findIndex((p) => p.priceId === priceId);
  const details = DETAILS[priceId];
  const { user } = useAuth();
  const { subscription, isActive, loading } = useSubscription();
  const hasLivePlan =
    isActive && !!subscription && ["active", "trialing", "past_due"].includes(subscription.status);
  const isCurrent = hasLivePlan && subscription?.price_id === priceId;
  const currentIndex = PLANS.findIndex((p) => p.priceId === subscription?.price_id);
  const direction = currentIndex < index ? "Upgrade" : "Switch";

  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewPlanChange>> | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!hasLivePlan || isCurrent) return;
    setPreview(null);
    setPreviewError(null);
    previewPlanChange({ data: { priceId, environment: getPaddleEnvironment() } })
      .then(setPreview)
      .catch((e: Error) => setPreviewError(e.message));
  }, [hasLivePlan, isCurrent, priceId]);

  const confirm = async () => {
    setChanging(true);
    try {
      await changePlan({ data: { priceId, environment: getPaddleEnvironment() } });
      setDone(true);
      toast.success(`You're now on ${plan.name}.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChanging(false);
    }
  };

  return (
    <MarketingShell>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <Link to="/pricing" className="text-sm text-muted-foreground underline">All plans</Link>
        <div className="mt-4 grid gap-10 md:grid-cols-[1fr_360px]">
          <section>
            <h1 className="font-serif text-5xl">{plan.name}</h1>
            <p className="mt-3 text-lg text-muted-foreground">{plan.blurb}</p>
            <p className="mt-6 rounded-lg border bg-card p-4 text-sm">
              <span className="font-medium">Best for: </span>{details.who}
            </p>
            <h2 className="mt-10 text-xl font-semibold">What's included</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {details.highlights.map((h) => (
                <div key={h.title} className="rounded-lg border bg-card p-4">
                  <div className="font-medium">{h.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{h.body}</p>
                </div>
              ))}
            </div>
            <h2 className="mt-10 text-xl font-semibold">Compare plans</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {PLANS.map((p) => {
                const slug = Object.keys(PLAN_SLUGS).find((s) => PLAN_SLUGS[s] === p.priceId)!;
                return (
                  <Link
                    key={p.priceId}
                    to="/plans/$planSlug"
                    params={{ planSlug: slug }}
                    className={`rounded-lg border p-4 text-sm ${p.priceId === priceId ? "border-foreground" : "hover:border-foreground/50"}`}
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="text-muted-foreground">{p.price}/mo</div>
                  </Link>
                );
              })}
            </div>
          </section>

          <aside className="h-fit rounded-2xl border bg-card p-6">
            <div className="text-4xl font-semibold">{plan.price}<span className="text-base font-normal text-muted-foreground">/mo</span></div>
            <ul className="mt-4 space-y-2 text-sm">
              {plan.features.map((f) => <li key={f}>✓ {f}</li>)}
            </ul>
            <div className="mt-6 space-y-3">
              {loading && user ? (
                <p className="text-sm text-muted-foreground">Checking your plan...</p>
              ) : isCurrent || done ? (
                <>
                  <p className="rounded-md bg-muted p-3 text-sm font-medium">This is your current plan.</p>
                  <Link to="/admin" className="block text-center text-sm underline">Back to dashboard</Link>
                </>
              ) : hasLivePlan ? (
                <>
                  {previewError ? (
                    <p className="text-sm text-destructive">{previewError}</p>
                  ) : !preview ? (
                    <p className="text-sm text-muted-foreground">Working out the price of the change...</p>
                  ) : preview.trialing ? (
                    <p className="text-sm text-muted-foreground">
                      You're on a free trial, so nothing is charged now. After the trial you'll pay{" "}
                      {money(preview.nextAmountCents, preview.currency)}.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Due today: <span className="font-medium text-foreground">{money(preview.dueNowCents, preview.currency)}</span>{" "}
                      (the difference for the rest of this month).
                      {preview.nextBilledAt && <> Then {money(preview.nextAmountCents, preview.currency)} on {new Date(preview.nextBilledAt).toLocaleDateString()}.</>}
                    </p>
                  )}
                  <button
                    onClick={confirm}
                    disabled={changing || !preview}
                    className="w-full rounded-full bg-foreground px-6 py-3 font-medium text-background hover:bg-accent disabled:opacity-50"
                  >
                    {changing ? "Changing plan..." : `${direction} to ${plan.name}`}
                  </button>
                  <p className="text-xs text-muted-foreground">Uses the card already on file. The new features unlock right away.</p>
                </>
              ) : (
                <>
                  <Link
                    to="/checkout"
                    search={{ plan: priceId }}
                    className="block rounded-full bg-foreground px-6 py-3 text-center font-medium text-background hover:bg-accent"
                  >
                    Start 14-day free trial
                  </Link>
                  <p className="text-xs text-muted-foreground">Nothing is charged for 14 days. Cancel anytime before then.</p>
                </>
              )}
            </div>
          </aside>
        </div>
      </main>
    </MarketingShell>
  );
}
