import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/sitemap")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/crawl-tools", search: { tab: "sitemap" }, replace: true });
  },
});
