import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!isAdmin) throw new Error("Forbidden");
}

export interface FollowUpLead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  business_name: string | null;
  preferred_call_time: string | null;
  source_page: string;
  follow_up_status: string;
  contacted_at: string | null;
  created_at: string;
  last_email_at: string | null;
  email_count: number;
}

/** Leads plus a summary of the follow-up emails already sent to each. */
export const listFollowUpLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabase } = context;

    const { data: leads, error } = await supabase
      .from("leads")
      .select(
        "id, name, email, phone, business_name, preferred_call_time, source_page, follow_up_status, contacted_at, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to load leads: ${error.message}`);

    const { data: emails, error: emailError } = await supabase
      .from("lead_followup_emails")
      .select("lead_id, ok, created_at")
      .order("created_at", { ascending: false });
    if (emailError) throw new Error(`Failed to load sent emails: ${emailError.message}`);

    const byLead = new Map<string, { count: number; last: string | null }>();
    for (const row of emails ?? []) {
      if (!row.ok) continue;
      const entry = byLead.get(row.lead_id) ?? { count: 0, last: null };
      entry.count += 1;
      if (!entry.last || row.created_at > entry.last) entry.last = row.created_at;
      byLead.set(row.lead_id, entry);
    }

    return {
      leads: (leads ?? []).map((l: any): FollowUpLead => ({
        ...l,
        last_email_at: byLead.get(l.id)?.last ?? null,
        email_count: byLead.get(l.id)?.count ?? 0,
      })),
    };
  });

const sendSchema = z.object({
  leadId: z.string().uuid(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});

export const sendLeadFollowUpEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => sendSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabase, userId } = context;

    const { data: lead, error } = await supabase
      .from("leads")
      .select("id, email, name")
      .eq("id", data.leadId)
      .single();
    if (error || !lead) throw new Error("Lead not found");

    const { renderLeadEmailHtml, sendLeadEmail } = await import("@/lib/lead-email.server");

    const result = await sendLeadEmail({
      to: lead.email,
      subject: data.subject,
      html: renderLeadEmailHtml(data.body),
    });

    const { error: logError } = await supabase.from("lead_followup_emails").insert({
      lead_id: lead.id,
      recipient_email: lead.email,
      subject: data.subject,
      body: data.body,
      ok: result.ok,
      error: result.error ?? null,
      sent_by: userId,
    });
    if (logError) console.error(`Failed to log follow-up email: ${logError.message}`);

    if (result.ok) {
      const { error: updateError } = await supabase
        .from("leads")
        .update({ follow_up_status: "contacted", contacted_at: new Date().toISOString() })
        .eq("id", lead.id);
      if (updateError) console.error(`Failed to update lead status: ${updateError.message}`);
    }

    return result;
  });

/** Emails already sent to one lead. */
export const listLeadEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ leadId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("lead_followup_emails")
      .select("id, subject, body, ok, error, created_at")
      .eq("lead_id", data.leadId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { emails: rows ?? [] };
  });
