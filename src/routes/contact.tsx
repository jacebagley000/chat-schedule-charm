import { createFileRoute, Link } from "@tanstack/react-router";
import { pageMeta, absoluteUrl } from "@/lib/seo";
import { MarketingShell } from "@/components/MarketingShell";
import { ComparisonLeadForm } from "@/components/ComparisonLeadForm";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: pageMeta({
      title: "Contact — FrontDesk AI",
      description: "Talk to the FrontDesk AI team. Send us a question or book a demo call at a time that suits you.",
      path: "/contact",
    }),
    links: [{ rel: "canonical", href: absoluteUrl("/contact") }],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <MarketingShell>
      <main className="mx-auto grid max-w-5xl gap-12 px-6 py-16 md:grid-cols-2">
        <section>
          <h1 className="mb-4 font-serif text-5xl">Talk to us</h1>
          <p className="mb-8 text-lg text-muted-foreground">
            Questions about FrontDesk AI, or want to see it on your own business? Send us a note — pick a call time and
            we'll put a demo on the calendar.
          </p>
          <ul className="space-y-3 text-muted-foreground">
            <li>✓ We reply within one business day</li>
            <li>✓ Demo calls take 30 minutes</li>
            <li>✓ No pressure, no contracts</li>
          </ul>
          <p className="mt-8 text-sm text-muted-foreground">
            Ready to start? <Link to="/signup/business" className="text-foreground underline">Create a business account</Link>
          </p>
        </section>
        <section>
          <ComparisonLeadForm page="/contact" cta="contact_page" />
        </section>
      </main>
    </MarketingShell>
  );
}
