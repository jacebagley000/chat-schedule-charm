import { useMemo, useState } from "react";
import { createFileRoute, HeadContent, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, ShieldOff, ShieldCheck } from "lucide-react";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getRobotsRules,
  saveRobotsConfig,
} from "@/lib/robots-config.functions";
import {
  allowRouteInConfig,
  auditNoindexRoutes,
  noindexRouteInConfig,
} from "@/lib/noindex-audit";

export const Route = createFileRoute("/_authenticated/admin/noindex")({
  head: () => ({
    meta: pageMeta({
      title: "Noindex audit — FrontDesk AI",
      description:
        "See which allowlisted routes are excluded from robots.txt and sitemap.xml, and switch them back on.",
      path: "/admin/noindex",
      noindex: true,
    }),
    links: [canonicalLink("/admin/noindex")],
  }),
  component: NoindexAuditPage,
});

function NoindexAuditPage() {
  const load = useServerFn(getRobotsRules);
  const save = useServerFn(saveRobotsConfig);
  const [pending, setPending] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["robots-rules"],
    queryFn: () => load({ data: undefined }),
  });

  const rows = useMemo(
    () => (data?.config ? auditNoindexRoutes(data.config) : []),
    [data],
  );
  const blockedCount = rows.filter((r) => !r.indexable).length;

  const toggle = async (path: string, nextIndexable: boolean) => {
    if (!data?.config) return;
    setPending(path);
    try {
      const nextConfig = nextIndexable
        ? allowRouteInConfig(data.config, path)
        : noindexRouteInConfig(data.config, path);
      const res = await save({ data: { config: nextConfig } });
      if (!res.saved) {
        toast.error(res.errors[0] ?? "Could not save the change");
        return;
      }
      toast.success(
        nextIndexable
          ? `${path} is now allowed in robots.txt and sitemap.xml`
          : `${path} is now excluded from robots.txt and sitemap.xml`,
      );
      await refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <HeadContent />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Noindex audit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every allowlisted route and whether robots.txt lets Google index it.
            Turning a route on removes the rules that were hiding it and rebuilds
            robots.txt and sitemap.xml.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading routes…</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {blockedCount === 0
              ? `All ${rows.length} allowlisted routes are indexable.`
              : `${blockedCount} of ${rows.length} allowlisted routes are currently noindexed.`}
          </p>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Why</TableHead>
                  <TableHead className="text-right">Allow indexing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.normalized}>
                    <TableCell className="font-mono text-sm">{row.path}</TableCell>
                    <TableCell>
                      {row.indexable ? (
                        <Badge variant="secondary" className="gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Indexable
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <ShieldOff className="h-3.5 w-3.5" />
                          Noindexed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.explanation}
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={row.indexable}
                        disabled={pending === row.path}
                        onCheckedChange={(checked) => toggle(row.path, checked)}
                        aria-label={`Allow indexing for ${row.path}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <PreviewBlock title="robots.txt" body={data?.robotsTxt ?? ""} />
            <PreviewBlock title="sitemap.xml" body={data?.sitemapXml ?? ""} />
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Need to add or remove routes entirely?{" "}
            <Link to="/admin/allowlist" className="underline">
              Open the allowlist editor
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}

function PreviewBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-2 text-sm font-medium">{title}</div>
      <pre className="max-h-72 overflow-auto p-4 text-xs leading-relaxed">
        {body}
      </pre>
    </div>
  );
}
