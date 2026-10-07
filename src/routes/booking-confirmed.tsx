import { useEffect } from "react";
import { trackBookingStep } from "@/lib/booking-funnel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, CalendarClock, Mail, PhoneCall } from "lucide-react";
import { pageMeta } from "@/lib/seo";
import { Button } from "@/components/ui/button";

interface BookingConfirmedSearch {
  name?: string;
  email?: string;
  business?: string;
  time?: string;
  booking?: string;
  emailSent?: string;
}

export const Route = createFileRoute("/booking-confirmed")({
  validateSearch: (search: Record<string, unknown>): BookingConfirmedSearch => ({
    name: typeof search.name === "string" ? search.name : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
    business: typeof search.business === "string" ? search.business : undefined,
    time: typeof search.time === "string" ? search.time : undefined,
    booking: typeof search.booking === "string" ? search.booking : undefined,
    emailSent: typeof search.emailSent === "string" ? search.emailSent : undefined,
  }),
  head: () => ({
    meta: pageMeta({
      title: "Booking confirmed — FrontDesk AI",
      description: "Your onboarding call request has been received. Here's what happens next.",
      noindex: true,
    }),
  }),
  component: BookingConfirmedPage,
});

function BookingConfirmedPage() {
  const { name, email, business, time, booking, emailSent } = Route.useSearch();
  const booked = booking === "booked";
  const emailWasSent = booked && emailSent === "1";
  useEffect(() => {
    trackBookingStep("view", booking ?? "none");
  }, [booking]);

  const formattedTime = time
    ? new Date(time).toLocaleString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : undefined;

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden />
        <h1 className="mt-4 text-3xl font-bold text-foreground">
          You're booked{name ? `, ${name}` : ""}!
        </h1>
        <p className="mt-2 text-muted-foreground">
          We've received your request for an onboarding call
          {business ? ` for ${business}` : ""}. Here's a summary of what you shared:
        </p>

        <dl className="mx-auto mt-6 grid max-w-md gap-3 text-left">
          {email && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
              <Mail className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs text-muted-foreground">Confirmation sent to</dt>
                <dd className="font-medium text-foreground">{email}</dd>
              </div>
            </div>
          )}
          {formattedTime && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
              <CalendarClock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs text-muted-foreground">{booked ? "Your demo call (booked)" : "Preferred call time"}</dt>
                <dd className="font-medium text-foreground">{formattedTime}</dd>
              </div>
            </div>
          )}
        </dl>

        <div className="mt-8 rounded-lg bg-muted/50 p-5 text-left">
          <h2 className="font-semibold text-foreground">What happens next</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              {booked
                ? "Your call is on our calendar and a confirmation email is on its way."
                : booking === "slot_taken"
                  ? "That time was just taken — we'll email you within one business day with the closest open time."
                  : "We'll email you within one business day to confirm your call time."}
            </li>
            <li>On the call, we'll learn how your front desk works today and show you FrontDesk AI on your own scenarios.</li>
            <li>If it's a fit, we can have your AI receptionist answering calls within a week.</li>
          </ol>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <a
              href="https://calendly.com/frontdesk-ai/onboarding"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackBookingStep("click_calendly", booking ?? "none")}
            >
              <PhoneCall className="mr-2 h-4 w-4" aria-hidden />
              Pick an exact time now
            </a>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/" onClick={() => trackBookingStep("click_home", booking ?? "none")}>Back to homepage</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
