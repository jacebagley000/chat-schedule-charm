/**
 * Lightweight, type-safe event tracking for marketing pages.
 *
 * Supports both Google Analytics 4 (gtag) and PostHog when their connector
 * env vars are present. Falls back to console logging in development and is
 * safe to call during SSR.
 */

export type AnalyticsProvider = "gtag" | "posthog" | "console" | "none";

export interface ComparisonCtaEvent {
  name: "comparison_cta_click";
  page: string;
  cta: "start_free" | "see_pricing" | "get_demo" | "related_comparison";
  location: "hero_cta" | "bottom_cta" | "related";
}

export interface ComparisonLeadEvent {
  name: "comparison_lead_submit" | "comparison_lead_error";
  page: string;
  cta?: string;
  email_domain?: string;
  reason?: string;
}

export interface SignupFunnelEvent {
  name: "trial_page_view" | "trial_start" | "sign_up" | "begin_checkout" | "trial_conversion";
  page: string;
  plan?: string;
  plan_name?: string;
  method?: "email" | "google";
  currency?: "USD";
  value?: number;
}

export type AnalyticsEvent = ComparisonCtaEvent | ComparisonLeadEvent | SignupFunnelEvent;

type GtagCommand = "event" | "config" | "js" | "set" | "consent";

interface WindowWithGtag extends Window {
  gtag?: (command: GtagCommand, ...args: unknown[]) => void;
  dataLayer?: unknown[];
}

interface WindowWithPosthog extends Window {
  posthog?: {
    capture: (event: string, properties?: Record<string, unknown>) => void;
  };
}

function detectProvider(): AnalyticsProvider {
  if (typeof window === "undefined") return "none";
  const w = window as WindowWithGtag & WindowWithPosthog;
  if (w.gtag) return "gtag";
  if (w.posthog?.capture) return "posthog";
  if (import.meta.env.DEV) return "console";
  return "none";
}

function sanitizeEventParams(params: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

let googleAnalyticsInitialized = false;

export function initializeGoogleAnalytics(): void {
  if (typeof window === "undefined" || googleAnalyticsInitialized) return;
  const measurementId = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY;
  if (!measurementId) return;

  const w = window as WindowWithGtag;
  w.dataLayer = w.dataLayer ?? [];
  w.gtag = (command: GtagCommand, ...args: unknown[]) => {
    w.dataLayer?.push([command, ...args]);
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  w.gtag("set", "developer_id.dZjgwMW", true);
  w.gtag("js", new Date());
  w.gtag("config", measurementId, { send_page_view: false });
  googleAnalyticsInitialized = true;
}

export function trackPageView(path: string): void {
  if (typeof window === "undefined") return;
  const w = window as WindowWithGtag;
  w.gtag?.("event", "page_view", {
    page_path: path,
    page_title: document.title,
    page_location: window.location.href,
  });
}

export function trackEvent(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;

  const provider = detectProvider();
  const params = sanitizeEventParams({
    page: event.page,
    ...(event.name === "comparison_cta_click" ? { cta: event.cta, location: event.location } : {}),
    ...(event.name === "comparison_lead_submit" || event.name === "comparison_lead_error"
      ? { cta: event.cta, email_domain: event.email_domain, reason: event.reason }
      : {}),
    ...("plan" in event
      ? {
          plan: event.plan,
          plan_name: event.plan_name,
          method: event.method,
          currency: event.currency,
          value: event.value,
        }
      : {}),
  });

  switch (provider) {
    case "gtag": {
      const w = window as WindowWithGtag;
      w.gtag?.("event", event.name, params);
      break;
    }
    case "posthog": {
      const w = window as WindowWithPosthog;
      w.posthog?.capture(event.name, params);
      break;
    }
    case "console": {
      console.log("[analytics]", event.name, params);
      break;
    }
    case "none":
    default:
      break;
  }
}

export function getAnalyticsProvider(): AnalyticsProvider {
  return detectProvider();
}
