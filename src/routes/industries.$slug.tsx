import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { pageMeta, absoluteUrl } from "@/lib/seo";
import { MarketingShell } from "@/components/MarketingShell";
import { getIndustry } from "@/content/marketing";

export const Route = createFileRoute("/industries/$slug")({
  loader: ({ params }) => {
    const industry = getIndustry(params.slug);
    if (!industry) throw notFound();
    return { industry };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Not found — FrontDesk AI" }, { name: "robots", content: "noindex" }] };
    const { industry } = loaderData;
    const path = `/industries/${params.slug}`;
    return {
      meta: pageMeta({
        title: `AI receptionist for ${industry.name.toLowerCase()} — FrontDesk AI`,
        description: industry.intro,
        ogTitle: `FrontDesk AI for ${industry.name}`,
        path,
      }),
      links: [{ rel: "canonical", href: absoluteUrl(path) }],
    };
  },
  notFoundComponent: IndustryNotFound,
  component: IndustryPage,
});

function IndustryNotFound() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="mb-4 font-serif text-4xl">We don't have that page yet</h1>
        <Link to="/industries" className="underline">See all industries</Link>
      </main>
    </MarketingShell>
  );
}

function IndustryPage() {
  const { industry } = Route.useLoaderData();
  return (
    <MarketingShell>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="mb-4 text-sm uppercase tracking-widest text-muted-foreground">{industry.name}</p>
        <h1 className="mb-6 font-serif text-5xl md:text-6xl">{industry.headline}</h1>
        <p className="mb-16 max-w-2xl text-lg text-muted-foreground">{industry.intro}</p>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-8">
            <h2 className="mb-4 font-serif text-2xl">What we fix</h2>
            <ul className="space-y-3">{industry.pains.map((p) => <li key={p}>✓ {p}</li>)}</ul>
          </div>
          <div className="rounded-3xl border border-border bg-card p-8">
            <h2 className="mb-4 font-serif text-2xl">Calls we handle every day</h2>
            <ul className="space-y-3 italic text-muted-foreground">{industry.examples.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        </div>
        <div className="mt-12 flex flex-wrap gap-4">
          <Link to="/pricing" className="rounded-full bg-foreground px-6 py-3 font-medium text-background hover:bg-accent">See pricing</Link>
          <Link to="/features" className="rounded-full border border-border px-6 py-3 font-medium hover:border-foreground">All features</Link>
        </div>
      </main>
    </MarketingShell>
  );
}
