import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/checkout/success")({
  head: () => ({
    meta: [
      { title: "You're subscribed — FrontDesk AI" },
      { name: "description", content: "Your FrontDesk AI subscription is active." },
      { property: "og:title", content: "You're subscribed — FrontDesk AI" },
      {
        property: "og:description",
        content: "Your FrontDesk AI subscription is active. Head to your dashboard to get started.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://chat-schedule-charm.lovable.app/checkout/success" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://chat-schedule-charm.lovable.app/checkout/success" }],
  }),

  component: CheckoutSuccess,
});

function CheckoutSuccess() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-4xl">You're all set.</h1>
        <p className="mt-4 text-muted-foreground">
          Your subscription is active. It may take a few seconds to unlock every feature —
          we'll refresh access automatically.
        </p>
        <Link
          to="/dashboard"
          className="mt-8 inline-block rounded-full bg-accent px-8 py-3 text-sm font-medium text-white transition-all hover:brightness-110"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
