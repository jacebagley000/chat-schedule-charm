import { useEffect, useMemo, useState } from "react";
import { createFileRoute, HeadContent, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ChangeFreq, RobotsRulesConfig } from "@/lib/public-routes";
import {
  getRobotsRules,
  previewRobotsConfig,
  saveRobotsConfig,
} from "@/lib/robots-config.functions";

const CHANGEFREQS: ChangeFreq[] = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
];

export const Route = createFileRoute("/_authenticated/admin/allowlist")({
  head: () => ({
    meta: pageMeta({
      title: "Allowlist editor — FrontDesk AI",
      description:
        "Edit allowlisted routes and their publicRobots flags, with live robots.txt and sitemap.xml rebuilds.",
      path: "/admin/allowlist",
      noindex: true,
    }),
    links: [canonicalLink("/admin/allowlist")],
  }),
  component: AllowlistEditorPage,
});

function AllowlistEditorPage() {
  const load = useServerFn(getRobotsRules);
  const preview = useServerFn(previewRobotsConfig);
  const save = useServerFn(saveRobotsConfig);

  const { data, isLoading, error } = useQuery({
    queryKey: ["robots-rules"],
    queryFn: () => load({ data: undefined }),
  });

  const [config, setConfig] = useState<RobotsRulesConfig | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [robotsTxt, setRobotsTxt] = useState("");
  const [sitemapXml, setSitemapXml] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setConfig(data.config);
    setRobotsTxt(data.robotsTxt);
    setSitemapXml(data.sitemapXml);
  }, [data]);

  // Live rebuild: whenever the config changes, re-render robots.txt + sitemap.xml.
  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await preview({ data: { config } });
        if (cancelled) return;
        setErrors(res.errors);
        setRobotsTxt(res.robotsTxt);
        setSitemapXml(res.sitemapXml);
      } catch {
        /* transient preview failure; save still validates */
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [config, preview]);

  const update = (patch: Partial<RobotsRulesConfig>) =>
    setConfig((c) => (c ? { ...c, ...patch } : c));

  const updateRoute = (index: number, patch: Partial<RobotsRulesConfig["allow"][number]>) =>
    setConfig((c) =>
      c
        ? { ...c, allow: c.allow.map((r, i) => (i === index ? { ...r, ...patch } : r)) }
        : c,
    );

  const publicCount = useMemo(
    () => config?.allow.filter((r) => r.publicRobots !== false).length ?? 0,
    [config],
  );

  const runSave = async () => {
    if (!config) return;
    setBusy(true);
    try {
      const res = await save({ data: { config } });
      setErrors(res.errors);
      setRobotsTxt(res.robotsTxt);
      setSitemapXml(res.sitemapXml);
      if (res.saved) {
        setConfig(res.config);
        toast.success("Allowlist saved — robots.txt and sitemap.xml rebuilt");
      } else {
        toast.error(res.errors[0] ?? "Could not save the allowlist");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <HeadContent />
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Allowlist editor</h1>
        <p className="text-sm text-muted-foreground">
          Edit allowlisted routes, their sitemap metadata and the{" "}
          <code>publicRobots</code> flag. robots.txt and sitemap.xml rebuild live as
          you type. Prefer raw directives?{" "}
          <Link to="/admin/crawl-tools" search={{ tab: "robots" as const }} className="underline">
            Use the robots.txt editor
          </Link>
          .
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading rules…</p>}
      {error && (
        <p className="text-sm text-destructive">
          {(error as Error).message === "Forbidden"
            ? "Admin access required."
            : (error as Error).message}
        </p>
      )}

      {config && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="space-y-8">
            <section className="space-y-2">
              <Label htmlFor="base-url">Base URL</Label>
              <Input
                id="base-url"
                value={config.baseUrl}
                onChange={(e) => update({ baseUrl: e.target.value })}
                spellCheck={false}
              />
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">
                  Allowlisted routes{" "}
                  <span className="text-muted-foreground">
                    ({publicCount} of {config.allow.length} public)
                  </span>
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update({
                      allow: [
                        ...config.allow,
                        { path: "/", changefreq: "monthly", priority: "0.5" },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 size-4" aria-hidden="true" />
                  Add route
                </Button>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Path</TableHead>
                      <TableHead className="w-[130px]">Change freq</TableHead>
                      <TableHead className="w-[100px]">Priority</TableHead>
                      <TableHead className="w-[120px]">publicRobots</TableHead>
                      <TableHead className="w-[52px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {config.allow.map((route, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Input
                            value={route.path}
                            aria-label={`Path for row ${i + 1}`}
                            spellCheck={false}
                            className="font-mono text-xs"
                            onChange={(e) => updateRoute(i, { path: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={route.changefreq ?? "monthly"}
                            onValueChange={(v) =>
                              updateRoute(i, { changefreq: v as ChangeFreq })
                            }
                          >
                            <SelectTrigger aria-label={`Change frequency for ${route.path}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CHANGEFREQS.map((f) => (
                                <SelectItem key={f} value={f}>
                                  {f}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={route.priority ?? "0.5"}
                            aria-label={`Priority for ${route.path}`}
                            inputMode="decimal"
                            onChange={(e) => updateRoute(i, { priority: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={route.publicRobots !== false}
                            aria-label={`Public robots for ${route.path}`}
                            onCheckedChange={(checked) =>
                              updateRoute(i, { publicRobots: checked ? undefined : false })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Remove ${route.path}`}
                            onClick={() =>
                              update({ allow: config.allow.filter((_, j) => j !== i) })
                            }
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Turning <code>publicRobots</code> off keeps the route registered but
                removes it from robots.txt and sitemap.xml, and serves it with the
                noindex header.
              </p>
            </section>

            <ListEditor
              title="Disallowed prefixes"
              placeholder="/admin/"
              values={config.disallow}
              onChange={(disallow) => update({ disallow })}
            />

            <ListEditor
              title="Sitemap URLs"
              placeholder="https://example.com/sitemap.xml"
              values={config.sitemaps}
              onChange={(sitemaps) => update({ sitemaps })}
            />

            {errors.length > 0 && (
              <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}

            <Button onClick={runSave} disabled={busy || errors.length > 0}>
              Save allowlist
            </Button>
          </div>

          <div className="space-y-4">
            <section>
              <h2 className="mb-1 text-sm font-medium">robots.txt preview</h2>
              <pre className="max-h-[320px] overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                {robotsTxt}
              </pre>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-medium">sitemap.xml preview</h2>
              <pre className="max-h-[320px] overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                {sitemapXml}
              </pre>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function ListEditor({
  title,
  placeholder,
  values,
  onChange,
}: {
  title: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        <Button size="sm" variant="outline" onClick={() => onChange([...values, ""])}>
          <Plus className="mr-1 size-4" aria-hidden="true" />
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {values.map((value, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={value}
              placeholder={placeholder}
              aria-label={`${title} ${i + 1}`}
              spellCheck={false}
              className="font-mono text-xs"
              onChange={(e) =>
                onChange(values.map((v, j) => (j === i ? e.target.value : v)))
              }
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Remove ${title} ${i + 1}`}
              onClick={() => onChange(values.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        {values.length === 0 && (
          <p className="text-xs text-muted-foreground">None configured.</p>
        )}
      </div>
    </section>
  );
}
