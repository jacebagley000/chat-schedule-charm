import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/search-console")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/crawl-tools", search: { tab: "search-console" }, replace: true });
  },
});
