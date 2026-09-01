import { createFileRoute, HeadContent, useNavigate } from "@tanstack/react-router";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RobotsEditorPanel } from "@/components/admin/RobotsEditorPanel";
import { SitemapOverviewPanel } from "@/components/admin/SitemapOverviewPanel";
import { SearchConsolePanel } from "@/components/admin/SearchConsolePanel";

const TABS = ["robots", "sitemap", "search-console"] as const;
type TabKey = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/admin/crawl-tools")({
  validateSearch: (search: Record<string, unknown>): { tab: TabKey } => {
    const tab = String(search.tab ?? "robots");
    return { tab: (TABS as readonly string[]).includes(tab) ? (tab as TabKey) : "robots" };
  },
  head: () => ({
    meta: pageMeta({
      title: "Crawl tools — FrontDesk AI",
      description:
        "Edit robots.txt rules, review the sitemap allowlist and submit the sitemap to Google Search Console.",
      path: "/admin/crawl-tools",
      noindex: true,
    }),
    links: [canonicalLink("/admin/crawl-tools")],
  }),
  component: CrawlToolsPage,
});

function CrawlToolsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <HeadContent />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Crawl tools</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          robots.txt rules, the sitemap allowlist and Google Search Console
          submission — all in one place.
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) =>
          navigate({ search: { tab: value as TabKey }, replace: true })
        }
      >
        <TabsList className="mb-6">
          <TabsTrigger value="robots">robots.txt</TabsTrigger>
          <TabsTrigger value="sitemap">Sitemap</TabsTrigger>
          <TabsTrigger value="search-console">Search Console</TabsTrigger>
        </TabsList>

        <TabsContent value="robots">
          <RobotsEditorPanel />
        </TabsContent>
        <TabsContent value="sitemap">
          <SitemapOverviewPanel />
        </TabsContent>
        <TabsContent value="search-console">
          <SearchConsolePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
