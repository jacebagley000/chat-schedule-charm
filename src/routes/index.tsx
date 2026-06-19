import { Link, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import heroImg from "@/assets/hero-phone-calendar.jpg";
import calendarImg from "@/assets/calendar-detail.jpg";
import sarahImg from "@/assets/testimonial-sarah.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

const steps = [
  {
    n: "01",
    title: "Forward your lines",
    body: "Connect your existing shop phone, Instagram, and Facebook DMs to our secure AI bridge. No new number, no new hardware.",
  },
  {
    n: "02",
    title: "Teach it your shop",
    body: "Upload your service menu, prices, and hours. The AI handles FAQs and quotes in the same tone you would.",
  },
  {
    n: "03",
    title: "Your calendar fills up",
    body: "Appointments land directly on your Google or Outlook calendar. You just show up and do the work.",
  },
];

const industries = [
  "Hair & Barbershops",
  "Auto Repair",
  "Dental & Medical",
  "Pet Grooming",
  "HVAC & Plumbing",
  "Yoga & Pilates",
  "Tattoo Studios",
  "Landscaping",
];

const tiers = [
  {
    name: "The Soloist",
    price: "$49",
    blurb: "For one-chair shops and solo operators.",
    features: ["Up to 100 calls/month", "Phone answering", "Calendar sync", "SMS confirmations"],
    cta: "Choose plan",
    popular: false,
  },
  {
    name: "Professional Shop",
    price: "$99",
    blurb: "For busy local businesses with a team.",
    features: [
      "Unlimited calls & DMs",
      "Instagram + Facebook DMs",
      "Custom knowledge base",
      "Priority appointment logic",
      "Outbound reminders",
    ],
    cta: "Start free trial",
    popular: true,
  },
  {
    name: "Multi-Location",
    price: "$199",
    blurb: "For owners running more than one shop.",
    features: ["Multiple calendars", "Team routing", "Centralized dashboard", "Dedicated account rep"],
    cta: "Contact sales",
    popular: false,
  },
];

const faqs = [
  {
    q: "Does it actually sound human on a phone call?",
    a: "Yes. We use modern, expressive voice synthesis tuned to sound like a calm front-desk person — not a robot. Customers regularly book without realizing it's AI.",
  },
  {
    q: "Will it know my specific prices and services?",
    a: "During setup you upload your service menu and any pricing notes. The AI quotes the same numbers you would, and it never invents a price it doesn't know.",
  },
  {
    q: "What if it doesn't know the answer?",
    a: "If a question is too specific, it politely takes the customer's name, number, and the question, then sends you an urgent notification so you can follow up personally.",
  },
  {
    q: "What happens to my existing phone number?",
    a: "You keep it. We forward your line through FrontDesk so the AI only picks up when you don't, or all the time if you prefer. Switching back takes one click.",
  },
  {
    q: "How long does setup take?",
    a: "Most shops are live in under an hour. Connect your phone and DMs, paste in your service menu, pick the AI's voice, and you're answering calls.",
  },
];

function Index() {
  const { user } = useAuth();
  return (
    <div className="bg-background text-foreground selection:bg-accent/20">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#" className="font-serif text-2xl font-bold italic tracking-tight">
            FrontDesk AI
          </a>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#how" className="text-sm font-medium transition-colors hover:text-accent">
              How it works
            </a>
            <a href="#industries" className="text-sm font-medium transition-colors hover:text-accent">
              Industries
            </a>
            <a href="#pricing" className="text-sm font-medium transition-colors hover:text-accent">
              Pricing
            </a>
            <a href="#faq" className="text-sm font-medium transition-colors hover:text-accent">
              FAQ
            </a>
          </div>
          <div className="flex items-center gap-4">
            <a href="/login" className="hidden text-sm font-medium transition-colors hover:text-accent sm:inline">
              Sign in
            </a>
            <a
              href="/signup"
              className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-all hover:bg-accent"
            >
              Start free trial
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="mx-auto grid max-w-7xl items-center gap-16 px-6 pt-16 pb-24 md:pt-24 md:pb-32 lg:grid-cols-2">
        <div className="animate-reveal">
          <span className="mb-6 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            AI receptionist for local businesses
          </span>
          <h1 className="mb-8 text-balance font-serif text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
            The receptionist <span className="italic">who never</span> misses a call.
          </h1>
          <p className="mb-10 max-w-[45ch] text-pretty text-lg text-muted-foreground">
            FrontDesk answers your shop phone and Instagram & Facebook DMs, qualifies customers,
            and books appointments straight into your calendar. No more lost business while
            you're busy working.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="/signup"
              className="rounded-full bg-accent px-8 py-4 font-medium text-white transition-all hover:brightness-110"
            >
              Start free trial
            </a>
            <a
              href="#demo"
              className="rounded-full border border-border px-8 py-4 font-medium transition-all hover:bg-black/5"
            >
              See it in action
            </a>
          </div>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            14-day free trial · No credit card · Cancel anytime
          </p>
        </div>

        <div className="animate-reveal relative [animation-delay:150ms]">
          <img
            src={heroImg}
            alt="Vintage brass shop telephone next to a tablet showing a full appointment calendar"
            width={896}
            height={1120}
            className="aspect-[4/5] w-full rounded-2xl object-cover ring-1 ring-black/5"
          />
          <div className="animate-reveal absolute -bottom-6 -left-6 max-w-xs rounded-xl bg-white p-6 shadow-xl ring-1 ring-black/5 [animation-delay:400ms]">
            <div className="mb-3 flex items-center gap-3">
              <div className="size-2 animate-pulse rounded-full bg-green-500" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Live booking · just now
              </span>
            </div>
            <p className="text-sm font-medium text-foreground">
              "Perfect, I've booked your balayage with Sarah for Tuesday at 2:00 PM."
            </p>
          </div>
        </div>
      </header>

      {/* Channels strip */}
      <section className="border-y border-border py-12">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-8 px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Answers customers wherever they reach you
          </span>
          <div className="flex flex-wrap items-center gap-x-12 gap-y-4 text-muted-foreground">
            <span className="font-medium">Phone line</span>
            <span className="opacity-30">·</span>
            <span className="font-medium">Instagram DM</span>
            <span className="opacity-30">·</span>
            <span className="font-medium">Facebook Messenger</span>
            <span className="opacity-30">·</span>
            <span className="font-medium">SMS</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="mb-20 max-w-2xl">
          <h2 className="mb-4 font-serif text-4xl md:text-5xl">Simple for you. Human for them.</h2>
          <p className="text-muted-foreground">
            Set up in an afternoon. Reclaim hours every day after that.
          </p>
        </div>
        <div className="grid gap-12 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="group">
              <span className="mb-6 block font-serif text-4xl italic text-accent">{s.n}</span>
              <h3 className="mb-3 text-xl font-bold">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Transcript / demo */}
      <section id="demo" className="overflow-hidden bg-foreground py-24 text-background md:py-32">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2 lg:gap-24">
          <div>
            <span className="mb-6 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-background/50">
              Real conversation · Instagram DM
            </span>
            <h2 className="mb-8 font-serif text-4xl md:text-5xl">Never sounds like a robot.</h2>
            <p className="mb-12 text-background/60">
              FrontDesk understands nuance, reschedules, follow-up questions, and your shop's
              specific services — with boutique-level care.
            </p>
            <div className="space-y-6 font-mono text-xs">
              <Line who="Customer" accent>
                "Hi! Do you have any openings for a men's cut tomorrow morning?"
              </Line>
              <Line who="FrontDesk">
                "Looking now… we have a 10:15 AM with James. Would that work?"
              </Line>
              <Line who="Customer" accent>
                "Yes! Let's do it. Do I need to prepay?"
              </Line>
              <Line who="FrontDesk">
                "No prepay needed. You're booked for 10:15 AM tomorrow — confirmation is on its
                way by text. See you then!"
              </Line>
            </div>
          </div>
          <img
            src={calendarImg}
            alt="Appointment calendar with colored service blocks"
            loading="lazy"
            width={896}
            height={896}
            className="aspect-square w-full rounded-2xl object-cover ring-1 ring-white/10"
          />
        </div>
      </section>

      {/* Industries */}
      <section id="industries" className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="mb-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-[15ch] font-serif text-4xl md:text-5xl">Tailored for your trade</h2>
          <p className="max-w-[36ch] text-muted-foreground">
            Every shop is different. FrontDesk learns your specific services, prices, and the
            people who do the work.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {industries.map((name, i) => (
            <div
              key={name}
              className="rounded-2xl bg-secondary p-6 ring-1 ring-border transition-all hover:bg-accent/10 hover:ring-accent/40"
            >
              <span className="mb-3 block font-mono text-[10px] text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h4 className="font-medium">{name}</h4>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial */}
      <section className="bg-secondary py-24 md:py-32">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
          <img
            src={sarahImg}
            alt="Sarah Jenkins, owner of Bloom & Stem Florist"
            loading="lazy"
            width={96}
            height={96}
            className="mb-8 size-20 rounded-full object-cover ring-1 ring-black/10"
          />
          <p className="mb-8 text-pretty font-serif text-2xl italic leading-snug md:text-3xl">
            "I used to spend three hours every evening returning missed calls from the day. Now
            those people are already on my books when I wake up. It changed my shop."
          </p>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Sarah Jenkins — Bloom & Stem Florist
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-serif text-4xl md:text-5xl">Simple, local-friendly pricing</h2>
          <p className="text-muted-foreground">No hidden fees. Just more time for your craft.</p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={
                "relative flex flex-col rounded-2xl p-8 " +
                (t.popular ? "bg-card ring-2 ring-accent" : "ring-1 ring-border")
              }
            >
              {t.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-white">
                  Most popular
                </span>
              )}
              <h3 className="mb-2 font-bold">{t.name}</h3>
              <div className="mb-3 font-serif text-4xl">
                {t.price}
                <span className="font-sans text-sm text-muted-foreground">/mo</span>
              </div>
              <p className="mb-6 text-sm text-muted-foreground">{t.blurb}</p>
              <ul className="mb-8 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#"
                className={
                  "mt-auto block rounded-full py-3 text-center text-sm font-medium transition-all " +
                  (t.popular
                    ? "bg-accent text-white hover:brightness-110"
                    : "border border-border hover:bg-black/5")
                }
              >
                {t.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-24 md:py-32">
        <h2 className="mb-12 font-serif text-4xl md:text-5xl">Common questions</h2>
        <div className="divide-y divide-border">
          {faqs.map((f) => (
            <details key={f.q} className="group cursor-pointer py-6">
              <summary className="flex list-none items-center justify-between gap-6 font-medium">
                <span>{f.q}</span>
                <span className="text-muted-foreground transition-transform group-open:rotate-180">
                  <svg
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </span>
              </summary>
              <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary pt-24 pb-12">
        <div className="mx-auto mb-24 max-w-7xl px-6 text-center">
          <h2 className="mb-8 font-serif text-4xl md:text-5xl">Ready to stop multitasking?</h2>
          <a
            href="#pricing"
            className="inline-block rounded-full bg-foreground px-10 py-5 font-medium text-background transition-all hover:bg-accent"
          >
            Start your 14-day free trial
          </a>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 border-t border-border px-6 pt-12 md:flex-row">
          <span className="font-serif text-xl font-bold italic">FrontDesk AI</span>
          <div className="flex gap-8 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground">
              Terms
            </a>
            <a href="#" className="hover:text-foreground">
              Contact
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} FrontDesk AI · Made for local shops.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Line({
  who,
  accent,
  children,
}: {
  who: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 border-b border-white/10 pb-4 last:border-0 last:pb-0">
      <span
        className={
          "w-24 shrink-0 uppercase " + (accent ? "text-accent" : "text-background/40")
        }
      >
        {who}
      </span>
      <span className="flex-1 text-background/90">{children}</span>
    </div>
  );
}
