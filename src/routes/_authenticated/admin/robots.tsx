import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/robots")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/crawl-tools", search: { tab: "robots" }, replace: true });
  },
});
