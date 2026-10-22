import { z } from "zod";

export const followUpSendSchema = z.object({
  leadId: z.string().uuid(),
  templateId: z.literal("demo-request-followup"),
}).strict();

export interface FollowUpTemplateLead {
  name: string;
  business_name: string | null;
  preferred_call_time: string | null;
}

/** Approved inquiry response. Both preview and server use stored lead details. */
export function buildLeadFollowUp(lead: FollowUpTemplateLead) {
  const when = lead.preferred_call_time
    ? new Date(lead.preferred_call_time).toISOString()
    : null;
  return {
    subject: "Following up on your FrontDesk AI demo request",
    body: `Hi ${lead.name},\n\nThanks for requesting a FrontDesk AI demo${lead.business_name ? ` for ${lead.business_name}` : ""}.\n\n${when
      ? `You requested a call at ${when} (UTC). Please reply to confirm whether this time still works. Your requested time is not a confirmed booking.`
      : "Please reply with a convenient time and timezone for your demo call."}\n\nThe FrontDesk AI team`,
  };
}