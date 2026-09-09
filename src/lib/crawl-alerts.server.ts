/** Server-only helpers for crawl health alert emails (sent through Resend). */
import type { CrawlFailure } from "@/lib/crawl-status-types";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "FrontDesk AI Crawl Monitor <onboarding@resend.dev>";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderAlertHtml(
  origin: string,
  failures: CrawlFailure[],
  checkedAt: string,
): string {
  const rows = failures
    .map(
      (f) =>
        `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;font-family:monospace">${escapeHtml(
          f.label,
        )}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${escapeHtml(
          f.detail,
        )}</td></tr>`,
    )
    .join("");

  return `<div style="font-family:system-ui,sans-serif;max-width:640px">
  <h2 style="margin:0 0 8px">Crawl health alert</h2>
  <p style="margin:0 0 16px;color:#555">
    ${failures.length} problem${failures.length === 1 ? "" : "s"} found on
    <strong>${escapeHtml(origin)}</strong> at ${escapeHtml(
      new Date(checkedAt).toUTCString(),
    )}.
  </p>
  <table style="border-collapse:collapse;width:100%;font-size:14px">
    <thead><tr>
      <th align="left" style="padding:6px 12px;border-bottom:2px solid #ddd">Path</th>
      <th align="left" style="padding:6px 12px;border-bottom:2px solid #ddd">Problem</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin:20px 0 0">
    <a href="${escapeHtml(origin)}/admin/crawl-dashboard">Open the crawl dashboard</a>
  </p>
</div>`;
}

export async function sendAlertEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  if (!lovableKey || !resendKey) {
    return { ok: false, error: "Email is not configured (missing Resend credentials)" };
  }

  try {
    const response = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from: FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Resend request failed [${response.status}]: ${body}`);
      return { ok: false, error: `Email provider failed [${response.status}]: ${body}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
