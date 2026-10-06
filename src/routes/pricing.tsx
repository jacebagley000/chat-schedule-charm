import { createFileRoute, Link } from "@tanstack/react-router";
import { pageMeta, absoluteUrl } from "@/lib/seo";
import { MarketingShell } from "@/components/MarketingShell";
import { PLANS } from "@/content/marketing";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: pageMeta({
      title: "Pricing — FrontDesk AI",
      description: "Simple monthly plans for FrontDesk AI, the AI receptionist for local businesses. From $49/month with a 14-day free trial.",
      path: "/pricing",
    }),
    links: [{ rel: "canonical", href: absoluteUrl("/pricing") }],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="mb-4 text-center font-serif text-5xl md:text-6xl">Simple, honest pricing</h1>
        <p className="mx-auto mb-16 max-w-2xl text-center text-lg text-muted-foreground">
          Every plan starts with a 14-day free trial. Upgrade, downgrade or cancel any time — changes are prorated.
        </p>
        <div className="grid gap-8 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.name} className={`flex flex-col rounded-3xl border p-8 ${p.popular ? "border-foreground bg-card shadow-lg" : "border-border bg-card"}`}>
              {p.popular && <span className="mb-4 w-fit rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">Most popular</span>}
              <h2 className="font-serif text-2xl">{p.name}</h2>
              <p className="mb-6 text-sm text-muted-foreground">{p.blurb}</p>
              <p className="mb-6 font-serif text-5xl">{p.price}<span className="font-sans text-sm text-muted-foreground">/mo</span></p>
              <ul className="mb-8 flex-1 space-y-3 text-sm">
                {p.features.map((f) => <li key={f}>✓ {f}</li>)}
              </ul>
              <Link to="/checkout" search={{ plan: p.priceId }} className="rounded-full bg-foreground px-6 py-3 text-center font-medium text-background hover:bg-accent">
                Choose {p.name}
              </Link>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-20 max-w-3xl space-y-6">
          <h2 className="font-serif text-3xl">Questions</h2>
          {[
            ["Do I need a credit card for the trial?", "No — you only add payment when you pick a plan."],
            ["What happens if I go over 100 calls on The Soloist?", "Calls keep being answered; we'll suggest upgrading, and the upgrade is prorated."],
            ["Can I cancel any time?", "Yes. There are no contracts or setup fees."],
          ].map(([q, a]) => (
            <div key={q} className="border-t border-border pt-4">
              <h3 className="font-medium">{q}</h3>
              <p className="text-muted-foreground">{a}</p>
            </div>
          ))}
        </div>
      </main>
    </MarketingShell>
  );
}
