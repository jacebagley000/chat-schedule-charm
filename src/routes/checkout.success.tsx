import { pageMeta } from "@/lib/seo";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/checkout/success")({
  head: () => ({
    meta: pageMeta({
      title: "You're subscribed — FrontDesk AI",
      description: "Your FrontDesk AI subscription is active.",
      ogDescription:
        "Your FrontDesk AI subscription is active. Head to your dashboard to get started.",
      path: "/checkout/success",
      noindex: true,
    }),
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
