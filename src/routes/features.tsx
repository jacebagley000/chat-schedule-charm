import { createFileRoute, Link } from "@tanstack/react-router";
import { pageMeta, absoluteUrl } from "@/lib/seo";
import { MarketingShell } from "@/components/MarketingShell";
import { FEATURES } from "@/content/marketing";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: pageMeta({
      title: "Features — FrontDesk AI",
      description: "See what FrontDesk AI does: answers calls and Instagram/Facebook DMs, books into your calendar without double-booking, speaks 12 languages and sends reminders.",
      path: "/features",
    }),
    links: [{ rel: "canonical", href: absoluteUrl("/features") }],
  }),
  component: FeaturesPage,
});

function FeaturesPage() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="mb-4 font-serif text-5xl md:text-6xl">Everything your front desk does — without the front desk.</h1>
        <p className="mb-16 max-w-2xl text-lg text-muted-foreground">
          FrontDesk AI answers, books and reminds, so you can keep working with the customer in front of you.
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-3xl border border-border bg-card p-8">
              <h2 className="mb-2 font-serif text-2xl">{f.title}</h2>
              <p className="text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-12 text-center text-muted-foreground">
          Ready to compare plans? <Link to="/pricing" className="text-foreground underline">See pricing</Link>
        </p>
      </main>
    </MarketingShell>
  );
}
