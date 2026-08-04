import { createFileRoute, Link } from "@tanstack/react-router";
import { brandGraph, ORGANIZATION_ID } from "@/lib/structured-data";
import { TrackedLink } from "@/components/TrackedLink";
import { ComparisonLeadForm } from "@/components/ComparisonLeadForm";

const PAGE_PATH = "/comparison/polyai";
const CANONICAL = `https://chat-schedule-charm.lovable.app${PAGE_PATH}`;


export const Route = createFileRoute("/comparison/polyai")({
  head: () => ({
    meta: [
      { title: "PolyAI Review & Alternative: PolyAI vs FrontDesk AI (2026)" },
      {
        name: "description",
        content:
          "Honest PolyAI review and side-by-side comparison with FrontDesk AI. See pricing, setup time, and which AI receptionist fits local shops vs. enterprise call centers.",
      },
      { property: "og:title", content: "PolyAI vs FrontDesk AI — Honest Comparison for Local Shops" },
      {
        property: "og:description",
        content:
          "PolyAI targets enterprise contact centers. FrontDesk AI is built for local shops. Compare pricing, setup, and features to pick the right AI receptionist.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            ...brandGraph,
            {
          "@type": "Article",
          headline: "PolyAI vs FrontDesk AI: Which AI Receptionist Is Right for You?",
          description:
            "A fair, side-by-side comparison of PolyAI and FrontDesk AI covering pricing, setup, target market, and best-fit use cases.",
          author: { "@id": ORGANIZATION_ID },
          publisher: { "@id": ORGANIZATION_ID },
          mainEntityOfPage: CANONICAL,
            },
          ],
        }),
      },
    ],
  }),
  component: PolyAIComparison,
});

function Row({ label, poly, us }: { label: string; poly: string; us: string }) {
  return (
    <tr className="border-t border-border">
      <td className="py-3 pr-4 font-medium text-foreground">{label}</td>
      <td className="py-3 pr-4 text-muted-foreground">{poly}</td>
      <td className="py-3 text-foreground">{us}</td>
    </tr>
  );
}

function PolyAIComparison() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <nav className="mb-8 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <span>Comparison</span>
        <span className="mx-2">/</span>
        <span className="text-foreground">PolyAI vs FrontDesk AI</span>
      </nav>

      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          PolyAI vs FrontDesk AI: An Honest Comparison
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Both answer calls with AI. They're built for very different customers. Here's a fair
          breakdown so you can pick the right one for your business.
        </p>
      </header>

      <section className="prose prose-neutral max-w-none dark:prose-invert">
        <h2>Short answer</h2>
        <p>
          <strong>PolyAI</strong> is an enterprise-grade voice AI platform for large contact centers —
          banks, hotel chains, insurers. Deep customization, long implementation, custom pricing.
        </p>
        <p>
          <strong>FrontDesk AI</strong> is a self-serve AI receptionist for local shops — salons,
          auto repair, dental offices, trades. It answers your phone and Instagram/Facebook DMs,
          qualifies customers, and books straight into your calendar. You're live the same day.
        </p>
        <p>
          If you have hundreds of agents and a procurement process, look at PolyAI. If you're a
          local business that just wants to stop missing calls, FrontDesk AI is built for you.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold text-foreground">Feature-by-feature</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 pr-4 font-semibold text-foreground">&nbsp;</th>
                <th className="py-3 pr-4 font-semibold text-foreground">PolyAI</th>
                <th className="py-3 font-semibold text-foreground">FrontDesk AI</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Target customer" poly="Enterprise contact centers" us="Local shops & SMBs" />
              <Row label="Pricing" poly="Custom (enterprise contract)" us="From $49/mo, self-serve" />
              <Row label="Setup time" poly="Weeks to months (implementation team)" us="Same day, no-code" />
              <Row label="Appointment booking" poly="Custom integration required" us="Built-in calendar & scheduling" />
              <Row label="Instagram & Facebook DMs" poly="Voice-first, DMs not core" us="Included out of the box" />
              <Row label="Multi-language" poly="Yes (extensive)" us="12 languages incl. Arabic (RTL)" />
              <Row label="Ideal call volume" poly="Thousands+/day" us="Any volume — pay as you grow" />
              <Row label="Contract" poly="Annual enterprise" us="Monthly, cancel anytime" />
            </tbody>
          </table>
        </div>
      </section>

      <section className="prose prose-neutral mt-12 max-w-none dark:prose-invert">
        <h2>Where PolyAI wins</h2>
        <ul>
          <li>Bespoke voice personas and deep NLU tuning for complex enterprise workflows.</li>
          <li>Integration with legacy contact-center stacks (Genesys, NICE, Avaya).</li>
          <li>Dedicated implementation and CS teams for large deployments.</li>
        </ul>

        <h2>Where FrontDesk AI wins</h2>
        <ul>
          <li>
            <strong>Time to value.</strong> You're taking real calls the day you sign up — no
            implementation project.
          </li>
          <li>
            <strong>Booking is the point.</strong> Appointments land in your calendar automatically,
            with staff-aware conflict checks and timezone handling.
          </li>
          <li>
            <strong>Social DMs included.</strong> Instagram and Facebook messages become scheduling
            requests in the same inbox as calls.
          </li>
          <li>
            <strong>Predictable pricing.</strong> $49–$199/mo flat, no per-minute enterprise
            contracts.
          </li>
        </ul>

        <h2>Who should pick which?</h2>
        <p>
          <strong>Pick PolyAI</strong> if you run an enterprise contact center, have a procurement
          budget, and need custom voice workflows integrated into a legacy telephony stack.
        </p>
        <p>
          <strong>Pick FrontDesk AI</strong> if you're a shop owner, clinic manager, or multi-location
          operator who wants to stop missing calls and DMs today — without hiring a receptionist or
          managing an implementation.
        </p>
      </section>

      <section className="mt-12 rounded-2xl border border-border bg-card p-8 text-center">
        <h2 className="text-2xl font-semibold text-foreground">Try FrontDesk AI free</h2>
        <p className="mt-2 text-muted-foreground">
          Answer every call and DM. Book every appointment. Live in minutes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <TrackedLink
            to="/signup"
            event={{ page: PAGE_PATH, cta: "start_free", location: "bottom_cta" }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start free
          </TrackedLink>
          <TrackedLink
            to="/"
            event={{ page: PAGE_PATH, cta: "see_pricing", location: "bottom_cta" }}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            See pricing
          </TrackedLink>
        </div>
        <div className="mt-6 flex justify-center">
          <ComparisonLeadForm page={PAGE_PATH} cta="get_demo" />
        </div>
      </section>


      <section className="mt-12">
        <h2 className="text-xl font-semibold text-foreground">Related comparisons</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TrackedLink
            to="/comparison/answering-service"
            event={{ page: PAGE_PATH, cta: "related_comparison", location: "related" }}
            className="group rounded-xl border border-border bg-background p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="font-medium text-foreground group-hover:text-accent">AI receptionist vs answering service</h3>
            <p className="mt-1 text-sm text-muted-foreground">What a human answering service costs, and where AI books more calls.</p>
          </TrackedLink>
          <TrackedLink
            to="/comparison/ai-receptionist-vs-live-chat"
            event={{ page: PAGE_PATH, cta: "related_comparison", location: "related" }}
            className="group rounded-xl border border-border bg-background p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="font-medium text-foreground group-hover:text-accent">AI receptionist vs live chat</h3>
            <p className="mt-1 text-sm text-muted-foreground">Live chat only catches website visitors — see what it misses.</p>
          </TrackedLink>
        </div>

      </section>
    </main>
  );
}
