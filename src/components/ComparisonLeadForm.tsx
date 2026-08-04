import * as React from "react";
import { useState, type FormEvent } from "react";
import { useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackEvent } from "@/lib/analytics";
import { submitLead } from "@/lib/leads.functions";

interface ComparisonLeadFormProps {
  page: string;
  cta?: string;
}

export function ComparisonLeadForm({ page, cta = "get_demo" }: ComparisonLeadFormProps) {
  const search = useSearch({ from: undefined, strict: false });
  const submit = useServerFn(submitLead);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [preferredCallTime, setPreferredCallTime] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!trimmedName || !trimmedEmail || !trimmedEmail.includes("@")) {
      setStatus("error");
      setErrorMessage("Please enter your name and a valid work email.");
      trackEvent({
        name: "comparison_lead_error",
        page,
        cta,
        reason: "invalid_input",
      });
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      await submit({
        data: {
          name: trimmedName,
          email: trimmedEmail,
          phone: phone.trim(),
          businessName: businessName.trim(),
          preferredCallTime: preferredCallTime || undefined,
          sourcePage: page,
          notes: notes.trim(),
          utmSource: search?.utm_source,
          utmMedium: search?.utm_medium,
          utmCampaign: search?.utm_campaign,
        },
      });

      trackEvent({
        name: "comparison_lead_submit",
        page,
        cta,
        email_domain: trimmedEmail.split("@")[1],
      });

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      trackEvent({
        name: "comparison_lead_error",
        page,
        cta,
        reason: "server_error",
      });
    }
  };

  if (status === "success") {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center" data-testid="lead-form-success">
        <p className="font-medium text-foreground">Thanks — we'll be in touch within one business day.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Prefer to pick a time now?{" "}
          <a
            href="https://calendly.com/frontdesk-ai/onboarding"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Schedule your onboarding call
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 grid max-w-xl gap-4 text-left"
      data-testid="lead-form"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`lead-name-${page}`}>Name</Label>
          <Input
            id={`lead-name-${page}`}
            type="text"
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`lead-email-${page}`}>Work email</Label>
          <Input
            id={`lead-email-${page}`}
            type="email"
            placeholder="you@business.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`lead-phone-${page}`}>Phone (optional)</Label>
          <Input
            id={`lead-phone-${page}`}
            type="tel"
            placeholder="+1 (555) 123-4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`lead-business-${page}`}>Business name (optional)</Label>
          <Input
            id={`lead-business-${page}`}
            type="text"
            placeholder="Smith Dental"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`lead-time-${page}`}>Preferred onboarding call time (optional)</Label>
        <Input
          id={`lead-time-${page}`}
          type="datetime-local"
          value={preferredCallTime}
          onChange={(e) => setPreferredCallTime(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Pick a time and we'll confirm by email.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`lead-notes-${page}`}>Notes (optional)</Label>
        <Input
          id={`lead-notes-${page}`}
          type="text"
          placeholder="What should we cover on the call?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {status === "error" && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="pt-2">
        <Button type="submit" disabled={status === "submitting"} className="w-full sm:w-auto">
          {status === "submitting" ? "Submitting..." : "Schedule an onboarding call"}
        </Button>
      </div>
    </form>
  );
}
