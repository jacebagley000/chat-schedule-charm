/** Server-only helpers for sending follow-up emails to leads (via Resend). */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "FrontDesk AI <onboarding@resend.dev>";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turns a plain-text body into simple branded HTML. */
export function renderLeadEmailHtml(body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(p).replace(
          /\n/g,
          "<br />",
        )}</p>`,
    )
    .join("");

  return `<div style="font-family:system-ui,sans-serif;max-width:600px;color:#111">
${paragraphs}
</div>`;
}

export async function sendLeadEmail(params: {
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
      return { ok: false, error: `Email provider failed [${response.status}]` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
