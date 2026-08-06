/**
 * Sanitize a user-supplied post-auth redirect target.
 *
 * Only same-origin absolute paths are allowed. Protocol-relative URLs
 * ("//evil.com"), backslash variants ("/\evil.com"), and absolute URLs
 * are rejected so a crafted `?redirect=` cannot send users off-site.
 */
export function safeRedirectPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback;
  const path = value.trim();
  if (!path.startsWith("/")) return fallback;
  // Reject protocol-relative and backslash-escaped external targets.
  if (/^[/\\]{2,}/.test(path)) return fallback;
  if (path.startsWith("/\\")) return fallback;
  // Reject anything with a scheme or control characters.
  if (/[\u0000-\u001f\u007f]/.test(path)) return fallback;
  try {
    const url = new URL(path, "https://placeholder.invalid");
    if (url.origin !== "https://placeholder.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
