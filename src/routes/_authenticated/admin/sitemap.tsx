import { useMemo, useState } from "react";
import { createFileRoute, HeadContent } from "@tanstack/react-router";
import { toast } from "sonner";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import {
  BASE_URL,
  PUBLIC_ROUTES,
  hasPublicRobots,
  normalizePath,
} from "@/lib/public-routes";

export const Route = createFileRoute("/_authenticated/admin/sitemap")({
  head: () => ({
    meta: pageMeta({
      title: "Sitemap overview — FrontDesk AI",
      description:
        "Every allowlisted route with its canonical URL, for comparison against the sitemap Google has indexed.",
      path: "/admin/sitemap",
      noindex: true,
    }),
    links: [canonicalLink("/admin/sitemap")],
  }),
  component: SitemapOverviewPage,
});

function SitemapOverviewPage() {
  const [copied, setCopied] = useState(false);

  const rows = useMemo(
    () =>
      PUBLIC_ROUTES.map((route) => {
        const path = normalizePath(route.path);
        return {
          path,
          canonical: `${BASE_URL}${path === "/" ? "/" : path}`,
          changefreq: route.changefreq ?? "—",
          priority: route.priority ?? "—",
          inSitemap: hasPublicRobots(route),
        };
      }).sort((a, b) => a.path.localeCompare(b.path)),
    [],
  );

  const indexed = rows.filter((r) => r.inSitemap);

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(indexed.map((r) => r.canonical).join("\n"));
      setCopied(true);
      toast.success("Canonical URLs copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <HeadContent />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Sitemap overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every allowlisted route and its canonical URL. Paste this list next to
          Google Search Console&rsquo;s indexed pages to spot missing or extra URLs.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button onClick={copyList} variant="secondary">
          {copied ? "Copied" : "Copy canonical URLs"}
        </Button>
        <a
          href="/sitemap.xml"
          target="_blank"
          rel="noreferrer"
          className="text-sm underline underline-offset-4"
        >
          Open sitemap.xml
        </a>
        <a
          href="/robots.txt"
          target="_blank"
          rel="noreferrer"
          className="text-sm underline underline-offset-4"
        >
          Open robots.txt
        </a>
        <span className="text-sm text-muted-foreground">
          {indexed.length} of {rows.length} routes in the sitemap
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Allowlisted routes and canonical URLs</caption>
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">Path</th>
              <th scope="col" className="px-4 py-3">Canonical URL</th>
              <th scope="col" className="px-4 py-3">Change freq</th>
              <th scope="col" className="px-4 py-3">Priority</th>
              <th scope="col" className="px-4 py-3">In sitemap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.path} className="border-t border-border">
                <td className="px-4 py-3 font-mono text-xs">{r.path}</td>
                <td className="px-4 py-3 font-mono text-xs break-all">
                  <a
                    href={r.canonical}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    {r.canonical}
                  </a>
                </td>
                <td className="px-4 py-3">{r.changefreq}</td>
                <td className="px-4 py-3">{r.priority}</td>
                <td className="px-4 py-3">
                  {r.inSitemap ? (
                    <span className="text-primary">Yes</span>
                  ) : (
                    <span className="text-muted-foreground">No (noindex)</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
