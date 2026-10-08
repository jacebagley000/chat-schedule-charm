import { useEffect } from "react";
import { trackTrialStep } from "@/lib/trial-funnel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { pageMeta, absoluteUrl } from "@/lib/seo";
import { MarketingShell } from "@/components/MarketingShell";
import { PLANS } from "@/content/marketing";

export const Route = createFileRoute("/trial")({
  validateSearch: (search: Record<string, unknown>): { plan?: string } => ({
    ...(typeof search.plan === "string" ? { plan: search.plan } : {}),
  }),
  head: () => ({
    meta: pageMeta({
      title: "Start your 14-day free trial — FrontDesk AI",
      description: "Try FrontDesk AI free for 14 days. Pick a plan, add a card, and pay nothing until your trial ends.",
      path: "/trial",
    }),
    links: [{ rel: "canonical", href: absoluteUrl("/trial") }],
  }),
  component: TrialPage,
});

function TrialPage() {
  const { plan: planId } = Route.useSearch();
  const selected = PLANS.find((p) => p.priceId === planId) ?? PLANS[1];
  useEffect(() => trackTrialStep("view", selected.priceId), [selected.priceId]);
  const endDate = new Date(Date.now() + 14 * 86400000).toLocaleDateString(undefined, { month: "long", day: "numeric" });

  const steps = [
    ["Today", "Create your account and add a card. You're not charged."],
    ["Days 1–14", "Your AI receptionist answers calls and DMs and books appointments — every feature of your plan is unlocked."],
    [`Around ${endDate}`, `Your first ${selected.price}/mo payment is taken. Cancel any time before then and you pay nothing.`],
  ];

  return (
    <MarketingShell>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="mb-4 font-serif text-5xl md:text-6xl">Try FrontDesk AI free for 14 days</h1>
        <p className="mb-12 max-w-2xl text-lg text-muted-foreground">
          Pick the plan you'd like to try. You'll get full access straight away and won't be charged until the trial ends.
        </p>

        <div className="mb-14 grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => {
            const active = p.priceId === selected.priceId;
            return (
              <Link
                key={p.priceId}
                to="/trial"
                search={{ plan: p.priceId }}
                replace
                className={`rounded-3xl border p-6 text-left transition ${active ? "border-foreground bg-card shadow-lg" : "border-border bg-card hover:border-foreground/40"}`}
              >
                <h2 className="font-serif text-2xl">{p.name}</h2>
                <p className="mb-2 text-sm text-muted-foreground">{p.blurb}</p>
                <p className="font-serif text-3xl">Free<span className="font-sans text-sm text-muted-foreground"> for 14 days, then {p.price}/mo</span></p>
              </Link>
            );
          })}
        </div>

        <h2 className="mb-6 font-serif text-3xl">How your trial works</h2>
        <ol className="mb-12 space-y-4">
          {steps.map(([when, what], i) => (
            <li key={when} className="flex gap-4 border-t border-border pt-4">
              <span className="font-serif text-2xl text-muted-foreground">{i + 1}</span>
              <div>
                <h3 className="font-medium">{when}</h3>
                <p className="text-muted-foreground">{what}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-4">
          <Link to="/checkout" search={{ plan: selected.priceId }} onClick={() => trackTrialStep("click_start", selected.priceId)} className="rounded-full bg-foreground px-8 py-4 font-medium text-background hover:bg-accent">
            Start free trial of {selected.name}
          </Link>
          <Link to="/pricing" className="text-sm text-muted-foreground underline">Compare plans</Link>
        </div>
      </main>
    </MarketingShell>
  );
}
