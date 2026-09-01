import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily cron endpoint: resubmits sitemap.xml to Google Search Console.
 * Authenticated with the SITEMAP_CRON_SECRET shared secret.
 */
export const Route = createFileRoute("/api/public/hooks/daily-sitemap-submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer /i, "") ??
          "";

        let authorized = false;
        const envSecret = process.env["SITEMAP_CRON_SECRET"];
        if (envSecret && provided.length === envSecret.length && provided === envSecret) {
          authorized = true;
        } else if (provided.length >= 32) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin
            .from("cron_secrets")
            .select("secret")
            .eq("name", "sitemap_daily")
            .maybeSingle();
          const dbSecret = (data as { secret?: string } | null)?.secret;
          authorized =
            !!dbSecret && dbSecret.length === provided.length && dbSecret === provided;
        }

        if (!authorized) {
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
