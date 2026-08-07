import { createFileRoute, Link } from "@tanstack/react-router";
import { brandGraph, ORGANIZATION_ID } from "@/lib/structured-data";
import { TrackedLink } from "@/components/TrackedLink";
import { ComparisonLeadForm } from "@/components/ComparisonLeadForm";

const PAGE_PATH = "/comparison/ai-receptionist-vs-live-chat";
const CANONICAL = `https://chat-schedule-charm.lovable.app${PAGE_PATH}`;

const faqs = [
  {
    q: "What is the difference between live chat and an AI receptionist?",
    a: "Live chat software puts a chat widget on your website and waits for a visitor to start a conversation, usually with a human on the other end during office hours. An AI receptionist like FrontDesk AI answers your phone line, Instagram and Facebook DMs, and website enquiries automatically, and books the appointment into your calendar during the conversation.",
  },
  {
    q: "What is the best live chat for a small business?",
    a: "For a small local business, the best option is usually one that covers every channel rather than the website alone. Traditional live chat tools only catch visitors already on your site, while FrontDesk AI handles calls, social DMs, and web enquiries from a single $49-a-month plan with no per-seat pricing.",
  },
  {
    q: "Can live chat book appointments automatically?",
    a: "Most live chat tools can share a booking link, but someone still has to click it and pick a slot. FrontDesk AI checks live staff availability, avoids double bookings, and writes the appointment straight to your calendar without handing the customer off to another page.",
  },
  {
    q: "Does an AI receptionist work outside office hours?",
    a: "Yes. FrontDesk AI replies 24/7, including nights, weekends, and holidays. Live chat staffed by your team goes offline when the shop closes, which is exactly when many customers try to book.",
  },
  {
    q: "How fast does it respond compared to live chat?",
    a: "Replies are instant, every time. Human-staffed live chat averages several minutes during busy periods, and most website visitors leave before an agent picks up the conversation.",
  },
  {
    q: "Do I still need live chat if I use an AI receptionist?",
    a: "Usually not. FrontDesk AI answers website enquiries alongside calls and DMs, so a separate chat subscription is often redundant. Teams that run a high-volume ecommerce support desk may still prefer a dedicated live chat tool for order issues.",
  },
  {
    q: "How long does it take to set up?",
    a: "Most businesses are live the same day. You upload your services, prices, and hours, connect your calendar, and forward your number or link your social accounts — no developer work required.",
  },
];

export const Route = createFileRoute("/comparison/ai-receptionist-vs-live-chat")({
  head: () => ({
    meta: [
      {
        title: "AI Receptionist vs Live Chat (2026) — FrontDesk AI",
      },

      {
        name: "description",
        content:
          "Compare an AI receptionist with live chat software. See which is the best live chat for small business, plus cost, 24/7 coverage, booking integration, and response speed.",
      },
      {
        property: "og:title",
        content: "AI Receptionist vs Live Chat — Best Option for Small Business?",
      },
      {
        property: "og:description",
        content:
          "Live chat software is reactive; an AI receptionist answers calls and DMs 24/7 and books appointments. Compare features, pricing, and fit for your business.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AI Receptionist vs Live Chat — Best Option for Small Business?" },
      { name: "twitter:description", content: "Live chat software is reactive; an AI receptionist answers calls and DMs 24/7 and books appointments. Compare features, pricing, and fit for your business." },
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
              headline:
                "AI Receptionist vs Live Chat: Which Is the Best Live Chat for Small Business?",
              description:
                "A side-by-side comparison of AI receptionists and live chat software for small businesses, covering cost, availability, booking integration, and response speed.",
              author: { "@id": ORGANIZATION_ID },
              publisher: { "@id": ORGANIZATION_ID },
              mainEntityOfPage: CANONICAL,
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Home",
                  item: "https://chat-schedule-charm.lovable.app/",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "AI Receptionist vs Live Chat",
                  item: CANONICAL,
                },
              ],
            },
          ],

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
  component: AiReceptionistVsLiveChat,
});

function Row({ label, liveChat, us }: { label: string; liveChat: string; us: string }) {
  return (
    <tr className="border-t border-border">
      <th scope="row" className="py-3 pr-4 text-left font-medium text-foreground">
        {label}
      </th>

      <td className="py-3 pr-4 text-muted-foreground">{liveChat}</td>
      <td className="py-3 text-foreground">{us}</td>
    </tr>
  );
}

function AiReceptionistVsLiveChat() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span>Comparison</span>
        <span className="mx-2">/</span>
        <span className="text-foreground">AI Receptionist vs Live Chat</span>
      </nav>

      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          AI Receptionist vs Live Chat: Best Live Chat for Small Business
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Live chat software keeps visitors on your website. An AI receptionist answers calls,
          texts, Instagram DMs, and Facebook messages — and books appointments automatically. Here's
          how to pick the right front-desk tool for your small business.
        </p>
      </header>

      <section className="prose prose-neutral max-w-none dark:prose-invert">
        <h2>Short answer</h2>
        <p>
          <strong>Live chat software</strong> is great for website visitors who want quick answers
          while they browse. It's reactive: someone has to start the chat, and a human or bot has to
          be ready to reply.
        </p>
        <p>
          An <strong>AI receptionist</strong> like FrontDesk AI is proactive across every channel
          your customers use — phone, Instagram, Facebook, and messaging. It qualifies leads,
          answers FAQs, and books appointments straight into your calendar, 24/7.
        </p>
        <p>
          If your goal is to capture website browsers, live chat helps. If your goal is to stop
          missing calls and DMs and book more appointments, an AI receptionist is the better live
          chat alternative for small business.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold text-foreground">Feature-by-feature</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-3 pr-4 font-semibold text-foreground">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold text-foreground">
                  Live chat software
                </th>
                <th scope="col" className="py-3 font-semibold text-foreground">
                  FrontDesk AI
                </th>

              </tr>
            </thead>
            <tbody>
              <Row
                label="Channels covered"
                liveChat="Website widget only"
                us="Phone, Instagram, Facebook, web"
              />
              <Row
                label="Availability"
                liveChat="When agents are online"
                us="24/7, instant replies"
              />
              <Row label="Monthly cost" liveChat="$15–$100+/seat" us="From $49/mo flat" />
              <Row
                label="Appointment booking"
                liveChat="Rarely built-in"
                us="Books straight into your calendar"
              />
              <Row
                label="Conflict detection"
                liveChat="Not included"
                us="Automatic overlap checks"
              />
              <Row
                label="Lead qualification"
                liveChat="Manual or basic bot"
                us="AI qualifies and routes leads"
              />
              <Row
                label="Languages"
                liveChat="Limited by agent team"
                us="12 languages incl. Arabic (RTL)"
              />
              <Row label="Setup time" liveChat="Hours to days" us="Same day, no-code" />
              <Row
                label="Best for"
                liveChat="E-commerce & support teams"
                us="Local shops, clinics, salons, trades"
              />
            </tbody>
          </table>
        </div>
      </section>

      <section className="prose prose-neutral mt-12 max-w-none dark:prose-invert">
        <h2>Where live chat software wins</h2>
        <ul>
          <li>
            <strong>Website conversion.</strong> A chat widget can nudge visitors to buy or book
            while they're already on your site.
          </li>
          <li>
            <strong>Visual context.</strong> Agents can share links, images, and screenshots in real
            time.
          </li>
          <li>
            <strong>Human handoff.</strong> Most live chat tools make it easy to transfer to a real
            person when needed.
          </li>
        </ul>

        <h2>Where FrontDesk AI wins</h2>
        <ul>
          <li>
            <strong>True 24/7 coverage.</strong> Every call and DM gets answered, even when your
            team is off the clock.
          </li>
          <li>
            <strong>Appointment-first design.</strong> FrontDesk AI isn't just chat — it books,
            reschedules, and checks for conflicts automatically.
          </li>
          <li>
            <strong>Multi-channel inbox.</strong> Phone, Instagram, and Facebook messages flow into
            one place, so nothing falls through the cracks.
          </li>
          <li>
            <strong>Predictable pricing.</strong> Flat monthly plans from $49–$199, no per-seat or
            per-minute surprises.
          </li>
          <li>
            <strong>Built for local business.</strong> Staff roles, locations, services, and
            timezone-aware scheduling are included out of the box.
          </li>
        </ul>

        <h2>Who should pick which?</h2>
        <p>
          <strong>Pick live chat software</strong> if you run an online store or SaaS and your main
          goal is converting website visitors with real-time support.
        </p>
        <p>
          <strong>Pick FrontDesk AI</strong> if you're a local business that wants the best live
          chat for small business — one that also answers the phone, handles social DMs, and books
          appointments while you serve customers.
        </p>
      </section>

      <section className="mt-12 rounded-2xl border border-border bg-card p-8 text-center">
        <h2 className="text-2xl font-semibold text-foreground">Try FrontDesk AI free</h2>
        <p className="mt-2 text-muted-foreground">
          Replace missed calls and scattered DMs with one AI receptionist that works 24/7.
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
        <h2 className="text-2xl font-semibold text-foreground">Frequently asked questions</h2>
        <dl className="mt-6 space-y-4">
          {faqs.map((f) => (
            <div key={f.q} className="rounded-xl border border-border bg-card p-5">
              <dt className="font-medium text-foreground">{f.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-foreground">Related comparisons</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TrackedLink
            to="/comparison/answering-service"
            event={{ page: PAGE_PATH, cta: "related_comparison", location: "related" }}
            className="group rounded-xl border border-border bg-background p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="font-medium text-foreground group-hover:text-accent">
              AI receptionist vs answering service
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              What a human answering service costs, and where AI books more calls.
            </p>
          </TrackedLink>
          <TrackedLink
            to="/comparison/polyai"
            event={{ page: PAGE_PATH, cta: "related_comparison", location: "related" }}
            className="group rounded-xl border border-border bg-background p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="font-medium text-foreground group-hover:text-accent">
              PolyAI vs FrontDesk AI
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Enterprise voice AI versus something a local shop can switch on today.
            </p>
          </TrackedLink>
        </div>
      </section>
    </main>
  );
}
