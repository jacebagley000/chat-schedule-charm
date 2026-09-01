import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/robots")({
  head: () => ({ meta: pageMeta({ title: "Redirecting — FrontDesk AI", noindex: true }) }),
  beforeLoad: () => {
    throw redirect({ to: "/admin/crawl-tools", search: { tab: "robots" }, replace: true });
  },
});
