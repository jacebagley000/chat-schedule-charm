import * as React from "react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackEvent } from "@/lib/analytics";

interface ComparisonLeadFormProps {
  page: string;
  cta?: string;
}

export function ComparisonLeadForm({ page, cta = "get_demo" }: ComparisonLeadFormProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const trimmed = email.trim();
    const emailDomain = trimmed.includes("@") ? trimmed.split("@")[1] : undefined;

    if (!trimmed || !emailDomain) {
      trackEvent({
        name: "comparison_lead_error",
        page,
        cta,
        reason: "invalid_email",
      });
      return;
    }

    trackEvent({
      name: "comparison_lead_submit",
      page,
      cta,
      email_domain: emailDomain,
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="lead-form-success">
        Thanks — we'll be in touch within one business day.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 text-left">
        <label htmlFor={`lead-email-${page}`} className="mb-1 block text-sm font-medium text-foreground">
          Work email
        </label>
        <Input
          id={`lead-email-${page}`}
          type="email"
          placeholder="you@business.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full"
        />
      </div>
      <Button type="submit" className="shrink-0">
        Get a demo
      </Button>
    </form>
  );
}
