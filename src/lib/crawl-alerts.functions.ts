import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  collectFailures,
  failureSignature,
  type CrawlAlertEvent,
  type CrawlAlertResult,
  type CrawlAlertSettings,
} from "@/lib/crawl-status-types";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!isAdmin) throw new Error("Forbidden");
}

interface SettingsRow {
  id: string;
  recipient_email: string | null;
  enabled: boolean;
  min_interval_minutes: number;
  last_alert_at: string | null;
  last_signature: string | null;
}

async function loadSettingsRow(supabase: any): Promise<SettingsRow | null> {
  const { data, error } = await supabase
    .from("crawl_alert_settings")
    .select("id, recipient_email, enabled, min_interval_minutes, last_alert_at, last_signature")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SettingsRow | null) ?? null;
}

function toSettings(row: SettingsRow | null): CrawlAlertSettings {
  return {
    recipientEmail: row?.recipient_email ?? "",
    enabled: row?.enabled ?? false,
    minIntervalMinutes: row?.min_interval_minutes ?? 60,
    lastAlertAt: row?.last_alert_at ?? null,
  };
}

async function loadEvents(supabase: any): Promise<CrawlAlertEvent[]> {
  const { data, error } = await supabase
    .from("crawl_alert_events")
    .select("id, recipient_email, subject, failure_count, kind, ok, error, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []).map((e: any) => ({
    id: e.id,
    recipientEmail: e.recipient_email,
    subject: e.subject,
    failureCount: e.failure_count,
    kind: e.kind,
    ok: e.ok,
    error: e.error,
    createdAt: e.created_at,
  }));
}

export const getCrawlAlertConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ settings: CrawlAlertSettings; events: CrawlAlertEvent[] }> => {
      await assertAdmin(context as never);
      const { supabase } = context as { supabase: any };
      const row = await loadSettingsRow(supabase);
      return { settings: toSettings(row), events: await loadEvents(supabase) };
    },
  );

export const saveCrawlAlertConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        recipientEmail: z.string().max(320),
        enabled: z.boolean(),
        minIntervalMinutes: z.number().int().min(5).max(1440),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ settings: CrawlAlertSettings }> => {
    await assertAdmin(context as never);
    const { supabase } = context as { supabase: any };

    const email = data.recipientEmail.trim();
    if (data.enabled && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
      throw new Error("Enter a valid email address before turning alerts on");
    }

    const existing = await loadSettingsRow(supabase);
    const payload = {
      recipient_email: email || null,
      enabled: data.enabled,
      min_interval_minutes: data.minIntervalMinutes,
    };

    const { data: saved, error } = existing
      ? await supabase
          .from("crawl_alert_settings")
          .update(payload)
          .eq("id", existing.id)
          .select(
            "id, recipient_email, enabled, min_interval_minutes, last_alert_at, last_signature",
          )
          .single()
      : await supabase
          .from("crawl_alert_settings")
          .insert(payload)
          .select(
            "id, recipient_email, enabled, min_interval_minutes, last_alert_at, last_signature",
          )
          .single();

    if (error) throw new Error(error.message);
    return { settings: toSettings(saved as SettingsRow) };
  });

/**
 * Re-runs the live crawl check server-side and emails the configured recipient
 * when robots.txt, sitemap.xml or any allowlisted URL is failing. Throttled by
 * the configured interval, and skipped when the failure set has not changed.
 */
export const runCrawlAlertCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CrawlAlertResult> => {
    await assertAdmin(context as never);
    const { supabase } = context as { supabase: any };

    const row = await loadSettingsRow(supabase);
    if (!row?.enabled) return { sent: false, reason: "disabled", failures: [] };
    const to = row.recipient_email?.trim();
    if (!to) return { sent: false, reason: "no-recipient", failures: [] };

    const { getRequest } = await import("@tanstack/react-start/server");
    const { collectCrawlStatus } = await import("@/lib/crawl-check.server");
    const origin = new URL(getRequest().url).origin;
    const report = await collectCrawlStatus(origin);
    const failures = collectFailures(report);

    if (failures.length === 0) {
      await supabase
        .from("crawl_alert_settings")
        .update({ last_signature: null })
        .eq("id", row.id);
      return { sent: false, reason: "healthy", failures };
    }

    const signature = failureSignature(failures);
    const sinceLast = row.last_alert_at
      ? (Date.now() - new Date(row.last_alert_at).getTime()) / 60000
      : Infinity;

    if (signature === row.last_signature && sinceLast < row.min_interval_minutes) {
      return { sent: false, reason: "unchanged", failures };
    }
    if (sinceLast < row.min_interval_minutes) {
      return { sent: false, reason: "throttled", failures };
    }

    const { renderAlertHtml, sendAlertEmail } = await import("@/lib/crawl-alerts.server");
    const subject = `[FrontDesk AI] ${failures.length} crawl problem${
      failures.length === 1 ? "" : "s"
    } on ${new URL(origin).host}`;
    const result = await sendAlertEmail({
      to,
      subject,
      html: renderAlertHtml(origin, failures, report.checkedAt),
    });

    await supabase.from("crawl_alert_events").insert({
      recipient_email: to,
      subject,
      failure_count: failures.length,
      failures,
      kind: "alert",
      ok: result.ok,
      error: result.error ?? null,
    });

    if (!result.ok) {
      return { sent: false, reason: "send-failed", failures, error: result.error };
    }

    await supabase
      .from("crawl_alert_settings")
      .update({ last_alert_at: new Date().toISOString(), last_signature: signature })
      .eq("id", row.id);

    return { sent: true, failures };
  });

/** Sends a sample alert to the saved recipient so delivery can be verified. */
export const sendCrawlAlertTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; error?: string }> => {
    await assertAdmin(context as never);
    const { supabase } = context as { supabase: any };

    const row = await loadSettingsRow(supabase);
    const to = row?.recipient_email?.trim();
    if (!to) throw new Error("Save a recipient email address first");

    const { getRequest } = await import("@tanstack/react-start/server");
    const origin = new URL(getRequest().url).origin;
    const { renderAlertHtml, sendAlertEmail } = await import("@/lib/crawl-alerts.server");

    const failures = [
      { label: "/example", detail: "Sample problem — this is a test alert" },
    ];
    const subject = "[FrontDesk AI] Test crawl health alert";
    const result = await sendAlertEmail({
      to,
      subject,
      html: renderAlertHtml(origin, failures, new Date().toISOString()),
    });

    await supabase.from("crawl_alert_events").insert({
      recipient_email: to,
      subject,
      failure_count: failures.length,
      failures,
      kind: "test",
      ok: result.ok,
      error: result.error ?? null,
    });

    return result;
  });
