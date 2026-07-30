import { createFileRoute, Link } from "@tanstack/react-router";

const CANONICAL = "https://chat-schedule-charm.lovable.app/comparison/answering-service";

const faqs = [
  {
    q: "What is the difference between an answering service and an AI receptionist?",
    a: "A traditional answering service uses human operators at a call centre to take messages and pass them on. An AI receptionist like FrontDesk AI answers the call itself, understands your services and prices, and books the appointment directly into your calendar — no message relay and no callback needed.",
  },
  {
    q: "How much does an answering service cost compared to FrontDesk AI?",
    a: "Most human answering services charge per minute or per call, which typically works out at $200–$1,000+ a month once after-hours and overflow calls are included. FrontDesk AI is a flat subscription starting at $49 a month with unlimited calls and messages, so a busy month never produces a surprise invoice.",
  },
  {
    q: "Can an AI receptionist really book appointments?",
    a: "Yes. FrontDesk AI checks live availability for the right staff member, avoids double bookings, and writes the appointment straight to your calendar during the conversation. A human answering service almost always takes a message and leaves the booking to you.",
  },
  {
    q: "Does it answer calls after hours and on weekends?",
    a: "Yes — FrontDesk AI answers 24/7, including nights, weekends, and holidays, at the same flat price. Most answering services charge premium rates for out-of-hours coverage.",
  },
  {
    q: "Does it handle Instagram and Facebook messages too?",
    a: "Yes. Alongside your phone line, FrontDesk AI replies to Instagram and Facebook DMs, answers common questions, and books from those conversations. Answering services are phone-only.",
  },
  {
    q: "Will customers know they're talking to AI?",
    a: "FrontDesk AI speaks naturally and is trained on your services, prices, and hours, so most conversations feel like talking to a well-briefed receptionist. You choose how it introduces itself, and anything it can't handle can be escalated to you.",
  },
  {
    q: "How long does it take to set up?",
    a: "Most shops are live the same day. You forward your existing number, upload your service menu and hours, and connect your calendar — no new hardware and no contract with a call centre.",
  },
];


export const Route = createFileRoute("/comparison/answering-service")({
  head: () => ({
    meta: [
      { title: "AI Receptionist vs Answering Service (2026) — FrontDesk AI" },
      {
        name: "description",
        content:
          "Compare a traditional answering service with FrontDesk AI's AI receptionist. See cost, 24/7 availability, calendar integration, and which is best for local businesses.",
      },
      { property: "og:title", content: "AI Receptionist vs Answering Service — Which Is Right for You?" },
      {
        property: "og:description",
        content:
          "Traditional answering service or AI receptionist? Compare cost, 24/7 availability, and calendar booking to decide what's best for your business.",
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
          "@type": "Article",
          headline: "AI Receptionist vs Answering Service: A Side-by-Side Comparison",
          description:
            "A fair comparison of traditional human answering services and AI receptionists like FrontDesk AI, covering cost, availability, and booking integration.",
          author: { "@type": "Organization", name: "FrontDesk AI" },
          mainEntityOfPage: CANONICAL,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: AnsweringServiceComparison,
});

function Row({ label, service, us }: { label: string; service: string; us: string }) {
  return (
    <tr className="border-t border-border">
      <td className="py-3 pr-4 font-medium text-foreground">{label}</td>
      <td className="py-3 pr-4 text-muted-foreground">{service}</td>
      <td className="py-3 text-foreground">{us}</td>
    </tr>
  );
}

function AnsweringServiceComparison() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <nav className="mb-8 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <span>Comparison</span>
        <span className="mx-2">/</span>
        <span className="text-foreground">AI Receptionist vs Answering Service</span>
      </nav>

      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          AI Receptionist vs Answering Service
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Traditional answering services have served businesses for decades. AI receptionists are the
          modern alternative. Here's an honest comparison to help you choose.
        </p>
      </header>

      <section className="prose prose-neutral max-w-none dark:prose-invert">
        <h2>Short answer</h2>
        <p>
          A <strong>human answering service</strong> answers your phone during set hours, takes
          messages, and may book appointments manually. It's reliable, but costs scale with every call
          and hour of coverage.
        </p>
        <p>
          An <strong>AI receptionist</strong> like FrontDesk AI answers calls and Instagram & Facebook
          DMs 24/7, qualifies customers, and books appointments directly into your calendar. It's
          faster, always on, and costs a flat monthly fee.
        </p>
        <p>
          If you need a personal touch for complex, high-value conversations, a human service may still
          win. If you want to stop missing calls and book more appointments while you work, an AI
          receptionist is the better fit.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold text-foreground">Feature-by-feature</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 pr-4 font-semibold text-foreground">&nbsp;</th>
                <th className="py-3 pr-4 font-semibold text-foreground">Traditional answering service</th>
                <th className="py-3 font-semibold text-foreground">FrontDesk AI</th>
              </tr>
            </thead>
            <tbody>
              <Row
                label="Monthly cost"
                service="$150–$2,000+ (per-minute or per-agent)"
                us="From $49/mo flat"
              />
              <Row label="Availability" service="Business hours or scheduled coverage" us="24/7, instant" />
              <Row label="Call answering" service="Human agent" us="AI voice assistant" />
              <Row
                label="Instagram & Facebook DMs"
                service="Usually not included"
                us="Included out of the box"
              />
              <Row
                label="Appointment booking"
                service="Manual entry or message relay"
                us="Books straight into your calendar"
              />
              <Row label="Conflict detection" service="Depends on agent" us="Automatic overlap checks" />
              <Row label="Languages" service="Limited by staffing" us="12 languages incl. Arabic (RTL)" />
              <Row label="Setup time" service="Days to weeks" us="Same day, no-code" />
              <Row label="Scalability" service="Hire more agents" us="Instant, no extra hiring" />
            </tbody>
          </table>
        </div>
      </section>

      <section className="prose prose-neutral mt-12 max-w-none dark:prose-invert">
        <h2>Where a traditional answering service wins</h2>
        <ul>
          <li>Complex, sensitive conversations where empathy and human judgment matter most.</li>
          <li>Industries with strict scripting requirements or heavy compliance oversight.</li>
          <li>Businesses that already have a trusted relationship with a long-term answering provider.</li>
        </ul>

        <h2>Where FrontDesk AI wins</h2>
        <ul>
          <li>
            <strong>Cost-effectiveness.</strong> Flat pricing from $49/mo instead of unpredictable
            per-minute bills.
          </li>
          <li>
            <strong>24/7 availability.</strong> Every call and DM gets answered, even nights,
            weekends, and holidays.
          </li>
          <li>
            <strong>Seamless calendar integration.</strong> Appointments are booked, rescheduled, and
            checked for conflicts automatically.
          </li>
          <li>
            <strong>Same-day setup.</strong> No implementation project — connect your calendar and
            start answering.
          </li>
          <li>
            <strong>Unified inbox.</strong> Calls, Instagram DMs, and Facebook messages flow into one
            place.
          </li>
        </ul>

        <h2>Who should pick which?</h2>
        <p>
          <strong>Pick a human answering service</strong> if your calls require deep empathy, bespoke
          handling, or you operate in a regulated environment where every word is scripted.
        </p>
        <p>
          <strong>Pick FrontDesk AI</strong> if you're a local shop, clinic, salon, or trades business
          that wants to answer every call, book every appointment, and never lose a customer to a busy
          signal again.
        </p>
      </section>

      <section className="mt-12 rounded-2xl border border-border bg-card p-8 text-center">
        <h2 className="text-2xl font-semibold text-foreground">Try FrontDesk AI free</h2>
        <p className="mt-2 text-muted-foreground">
          Replace your answering service with an AI receptionist that works 24/7.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start free
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            See pricing
          </Link>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-foreground">Related comparisons</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Link
            to="/comparison/ai-receptionist-vs-live-chat"
            className="group rounded-xl border border-border bg-background p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="font-medium text-foreground group-hover:text-accent">AI receptionist vs live chat</h3>
            <p className="mt-1 text-sm text-muted-foreground">Live chat only catches website visitors — see what it misses.</p>
          </Link>
          <Link
            to="/comparison/polyai"
            className="group rounded-xl border border-border bg-background p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="font-medium text-foreground group-hover:text-accent">PolyAI vs FrontDesk AI</h3>
            <p className="mt-1 text-sm text-muted-foreground">Enterprise voice AI versus something a local shop can switch on today.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
