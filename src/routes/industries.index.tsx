import { createFileRoute, Link } from "@tanstack/react-router";
import { pageMeta, absoluteUrl } from "@/lib/seo";
import { MarketingShell } from "@/components/MarketingShell";
import { INDUSTRIES } from "@/content/marketing";

export const Route = createFileRoute("/industries/")({
  head: () => ({
    meta: pageMeta({
      title: "Industries — FrontDesk AI",
      description: "FrontDesk AI for salons, barbershops, clinics and home services. See how an AI receptionist books appointments for your kind of business.",
      path: "/industries",
    }),
    links: [{ rel: "canonical", href: absoluteUrl("/industries") }],
  }),
  component: IndustriesPage,
});

function IndustriesPage() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="mb-4 font-serif text-5xl md:text-6xl">Built for businesses that book.</h1>
        <p className="mb-16 max-w-2xl text-lg text-muted-foreground">Pick your industry to see how FrontDesk AI fits your day.</p>
        <div className="grid gap-6 md:grid-cols-2">
          {INDUSTRIES.map((i) => (
            <Link key={i.slug} to="/industries/$slug" params={{ slug: i.slug }} className="rounded-3xl border border-border bg-card p-8 transition-colors hover:border-foreground">
              <h2 className="mb-2 font-serif text-2xl">{i.name}</h2>
              <p className="text-muted-foreground">{i.headline}</p>
            </Link>
          ))}
        </div>
      </main>
    </MarketingShell>
  );
}
