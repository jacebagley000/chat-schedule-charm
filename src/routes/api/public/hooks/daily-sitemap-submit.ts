import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily cron endpoint: resubmits sitemap.xml to Google Search Console.
 * Authenticated with the SITEMAP_CRON_SECRET shared secret.
 */
export const Route = createFileRoute("/api/public/hooks/daily-sitemap-submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SITEMAP_CRON_SECRET"];
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer /i, "") ??
          "";

        if (!secret || provided.length !== secret.length || provided !== secret) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { runDailySitemapSubmission } = await import("@/lib/sitemap-submit.server");
        const result = await runDailySitemapSubmission("cron");

        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 502,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
