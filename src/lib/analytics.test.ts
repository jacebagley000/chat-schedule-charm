import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { trackEvent, getAnalyticsProvider } from "./analytics";

describe("analytics", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.stubGlobal("gtag", undefined);
    vi.stubGlobal("posthog", undefined);
    vi.stubGlobal("console", { log: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers gtag over posthog and console", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag, posthog: { capture: vi.fn() } } as unknown as Window & typeof globalThis);
    expect(getAnalyticsProvider()).toBe("gtag");
  });

  it("falls back to posthog when gtag is absent", () => {
    const capture = vi.fn();
    vi.stubGlobal("window", { posthog: { capture } } as unknown as Window & typeof globalThis);
    expect(getAnalyticsProvider()).toBe("posthog");
  });

  it("sends comparison_cta_click to gtag with sanitized params", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag } as unknown as Window & typeof globalThis);
    trackEvent({
      name: "comparison_cta_click",
      page: "/comparison/answering-service",
      cta: "start_free",
      location: "bottom_cta",
    });
    expect(gtag).toHaveBeenCalledWith("event", "comparison_cta_click", {
      page: "/comparison/answering-service",
      cta: "start_free",
      location: "bottom_cta",
    });
  });

  it("sends comparison_lead_submit to posthog with email domain", () => {
    const capture = vi.fn();
    vi.stubGlobal("window", { posthog: { capture } } as unknown as Window & typeof globalThis);
    trackEvent({
      name: "comparison_lead_submit",
      page: "/comparison/polyai",
      cta: "get_demo",
      email_domain: "example.com",
    });
    expect(capture).toHaveBeenCalledWith("comparison_lead_submit", {
      page: "/comparison/polyai",
      cta: "get_demo",
      email_domain: "example.com",
    });
  });

  it("strips undefined params before sending", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag } as unknown as Window & typeof globalThis);
    trackEvent({
      name: "comparison_lead_error",
      page: "/comparison/ai-receptionist-vs-live-chat",
      reason: "invalid_email",
    });
    expect(gtag).toHaveBeenCalledWith("event", "comparison_lead_error", {
      page: "/comparison/ai-receptionist-vs-live-chat",
      reason: "invalid_email",
    });
  });

  it("is a no-op when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(() =>
      trackEvent({
        name: "comparison_cta_click",
        page: "/comparison/polyai",
        cta: "start_free",
        location: "bottom_cta",
      }),
    ).not.toThrow();
  });
});
