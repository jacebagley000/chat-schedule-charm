import { describe, expect, it } from "vitest";
import { buildLeadFollowUp, followUpSendSchema } from "./lead-followup-template";
import { renderLeadEmailHtml } from "./lead-email.server";

const leadId = "11111111-1111-4111-8111-111111111111";

describe("approved lead follow-up", () => {
  it("accepts only the approved template and lead ID", () => {
    expect(followUpSendSchema.parse({ leadId, templateId: "demo-request-followup" })).toEqual({ leadId, templateId: "demo-request-followup" });
    for (const extra of [{ subject: "Custom" }, { body: "Custom" }, { to: "other@example.com" }, { html: "<script />" }]) {
      expect(followUpSendSchema.safeParse({ leadId, templateId: "demo-request-followup", ...extra }).success).toBe(false);
    }
    expect(followUpSendSchema.safeParse({ leadId, templateId: "arbitrary" }).success).toBe(false);
    expect(followUpSendSchema.safeParse({ leadId: "invalid", templateId: "demo-request-followup" }).success).toBe(false);
  });

  it("uses a fixed subject and asks for a time when none was supplied", () => {
    const message = buildLeadFollowUp({ name: "Jane", business_name: null, preferred_call_time: null });
    expect(message.subject).toBe("Following up on your FrontDesk AI demo request");
    expect(message.body).toContain("Please reply with a convenient time and timezone");
  });

  it("uses the stored call instant without falsely confirming a booking", () => {
    const message = buildLeadFollowUp({ name: "Jane", business_name: "Salon", preferred_call_time: "2026-10-23T14:00:00-05:00" });
    expect(message.body).toContain("2026-10-23T19:00:00.000Z (UTC)");
    expect(message.body).toContain("not a confirmed booking");
  });

  it("escapes stored lead content before rendering HTML", () => {
    const message = buildLeadFollowUp({ name: '<img src=x onerror="alert(1)">', business_name: "A&B", preferred_call_time: null });
    const html = renderLeadEmailHtml(message.body);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("A&amp;B");
  });
});