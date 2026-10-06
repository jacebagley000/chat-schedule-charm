/** Server-only: books a website demo-call request into the FrontDesk AI business calendar. */
import { escapeHtml, sendLeadEmail } from "./lead-email.server";

const DEMO_BUSINESS_ID = "1334982c-50e3-4a90-87ae-2d9a5f489870";
const DEMO_SERVICE_NAME = "Demo call";

export type DemoBookingResult = {
  status: "booked" | "slot_taken" | "past_time" | "not_configured" | "error";
  emailSent: boolean;
};

export async function bookDemoCall(input: {
  name: string;
  email: string;
  phone?: string;
  businessName?: string;
  startsAt: string;
}): Promise<DemoBookingResult> {
  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) {
    return { status: "past_time", emailSent: false };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: biz }, { data: service }, { data: staff }] = await Promise.all([
    supabaseAdmin.from("businesses").select("timezone").eq("id", DEMO_BUSINESS_ID).maybeSingle(),
    supabaseAdmin.from("services").select("id, duration_minutes")
      .eq("business_id", DEMO_BUSINESS_ID).eq("name", DEMO_SERVICE_NAME).eq("active", true).maybeSingle(),
    supabaseAdmin.from("staff").select("id").eq("business_id", DEMO_BUSINESS_ID).eq("active", true)
      .order("created_at").limit(1).maybeSingle(),
  ]);
  if (!service || !staff) return { status: "not_configured", emailSent: false };

  const end = new Date(start.getTime() + service.duration_minutes * 60_000);

  // Reuse an existing customer with the same email, otherwise create one.
  const email = input.email.toLowerCase();
  const { data: existing } = await supabaseAdmin.from("customers").select("id")
    .eq("business_id", DEMO_BUSINESS_ID).ilike("email", email).limit(1).maybeSingle();
  let customerId = existing?.id;
  if (!customerId) {
    const { data: created, error } = await supabaseAdmin.from("customers").insert({
      business_id: DEMO_BUSINESS_ID, name: input.name, email, phone: input.phone ?? null,
      notes: input.businessName ? `Business: ${input.businessName}` : null,
    }).select("id").single();
    if (error) { console.error("demo booking customer", error); return { status: "error", emailSent: false }; }
    customerId = created.id;
  }

  const { error: apptError } = await supabaseAdmin.from("appointments").insert({
    business_id: DEMO_BUSINESS_ID, customer_id: customerId, staff_id: staff.id, service_id: service.id,
    starts_at: start.toISOString(), ends_at: end.toISOString(), status: "confirmed", source: "web",
    notes: `Booked from website${input.businessName ? ` for ${input.businessName}` : ""}`,
  });
  if (apptError) {
    if (/Time conflict/i.test(apptError.message)) return { status: "slot_taken", emailSent: false };
    console.error("demo booking appointment", apptError);
    return { status: "error", emailSent: false };
  }

  const when = start.toLocaleString("en-US", {
    timeZone: biz?.timezone ?? "America/New_York", weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
  const sent = await sendLeadEmail({
    to: input.email,
    subject: `Your FrontDesk AI demo call is confirmed — ${when}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:600px;color:#111;line-height:1.6">
<p>Hi ${escapeHtml(input.name)},</p>
<p>Your ${service.duration_minutes}-minute FrontDesk AI demo call is confirmed for <strong>${escapeHtml(when)}</strong>.</p>
<p>On the call we'll learn how your front desk works today and show you FrontDesk AI on your own scenarios.</p>
<p>Need a different time? Just reply to this email.</p>
<p>— The FrontDesk AI team</p></div>`,
  });
  if (!sent.ok) console.error("demo booking email", sent.error);
  return { status: "booked", emailSent: sent.ok };
}
