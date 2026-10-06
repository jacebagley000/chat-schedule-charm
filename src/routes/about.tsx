import { createFileRoute, Link } from "@tanstack/react-router";
import { pageMeta, absoluteUrl } from "@/lib/seo";
import { MarketingShell } from "@/components/MarketingShell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: pageMeta({
      title: "About — FrontDesk AI",
      description: "FrontDesk AI is an AI receptionist built for local businesses that book appointments — salons, barbershops, clinics and home services.",
      path: "/about",
    }),
    links: [{ rel: "canonical", href: absoluteUrl("/about") }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-6 font-serif text-5xl md:text-6xl">A front desk for businesses that can't stop to pick up.</h1>
        <div className="space-y-6 text-lg text-muted-foreground">
          <p>
            Local businesses lose bookings every day for one simple reason: the person who could answer the phone is busy
            with a customer. FrontDesk AI exists so that never costs you a booking again.
          </p>
          <p>
            We answer your calls and Instagram and Facebook messages, answer questions about your services and hours, and
            book appointments straight into your calendar — in your timezone, with the right staff member, without double-booking.
          </p>
          <p>
            We build for salons, barbershops, clinics and home-service companies: businesses where the work happens in person
            and the schedule is everything.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            ["Built for local shops", "Not a call-center tool squeezed down. Set up in minutes, no IT team needed."],
            ["Your calendar, kept right", "Real availability per staff member, conflict checks on every booking."],
            ["Honest pricing", "Simple monthly plans. Change or cancel any time."],
          ].map(([t, b]) => (
            <div key={t} className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-2 font-serif text-xl text-foreground">{t}</h2>
              <p className="text-sm text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap gap-4">
          <Link to="/signup/business" className="rounded-full bg-foreground px-6 py-3 font-medium text-background hover:bg-accent">Create a business account</Link>
          <Link to="/contact" className="rounded-full border border-border px-6 py-3 font-medium hover:border-foreground">Contact us</Link>
        </div>
      </main>
    </MarketingShell>
  );
}
