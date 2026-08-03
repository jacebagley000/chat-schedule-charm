import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { renderRobotsTxt } from "@/lib/public-routes";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(renderRobotsTxt(), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
