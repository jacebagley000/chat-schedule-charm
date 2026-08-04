import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ComparisonLeadForm } from "./ComparisonLeadForm";

const submitMock = vi.fn();
const trackEventMock = vi.fn();

vi.mock("@tanstack/react-start", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-start")>("@tanstack/react-start");
  return {
    ...actual,
    useServerFn: () => submitMock,
  };
});

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ searchStr: "?utm_source=google&utm_medium=cpc" }),
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
}));

beforeEach(() => {
  submitMock.mockReset();
  trackEventMock.mockReset();
});

describe("ComparisonLeadForm", () => {
  it("renders all fields and submits a lead", async () => {
    submitMock.mockResolvedValueOnce({ success: true });

    render(<ComparisonLeadForm page="/comparison/answering-service" cta="schedule_call" />);

    fireEvent.change(screen.getByPlaceholderText("Jane Smith"), { target: { value: "Jane Smith" } });
    fireEvent.change(screen.getByPlaceholderText("you@business.com"), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("+1 (555) 123-4567"), {
      target: { value: "+15551234567" },
    });
    fireEvent.change(screen.getByPlaceholderText("Smith Dental"), {
      target: { value: "Smith Dental" },
    });
    fireEvent.change(screen.getByPlaceholderText("What should we cover on the call?"), {
      target: { value: "Need after-hours coverage" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Schedule an onboarding call/i }));

    await waitFor(() => {
      expect(screen.getByTestId("lead-form-success")).toBeInTheDocument();
    });

    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Jane Smith",
          email: "jane@example.com",
          phone: "+15551234567",
          businessName: "Smith Dental",
          notes: "Need after-hours coverage",
          sourcePage: "/comparison/answering-service",
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: undefined,
        }),
      })
    );

    expect(trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "comparison_lead_submit" })
    );
  });

  it("shows validation error for empty required fields", async () => {
    render(<ComparisonLeadForm page="/comparison/polyai" />);

    fireEvent.click(screen.getByRole("button", { name: /Schedule an onboarding call/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Please enter your name and a valid work email/i);
    });

    expect(submitMock).not.toHaveBeenCalled();
  });

  it("shows server error when submission fails", async () => {
    submitMock.mockRejectedValueOnce(new Error("Database timeout"));

    render(<ComparisonLeadForm page="/comparison/ai-receptionist-vs-live-chat" />);

    fireEvent.change(screen.getByPlaceholderText("Jane Smith"), { target: { value: "Jane Smith" } });
    fireEvent.change(screen.getByPlaceholderText("you@business.com"), {
      target: { value: "jane@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Schedule an onboarding call/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Database timeout/i);
    });
  });
});
