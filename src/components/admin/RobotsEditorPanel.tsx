import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getRobotsRules,
  previewRobotsRules,
  saveRobotsRules,
} from "@/lib/robots-config.functions";


export function RobotsEditorPanel() {
  const load = useServerFn(getRobotsRules);
  const preview = useServerFn(previewRobotsRules);
  const save = useServerFn(saveRobotsRules);

  const { data, isLoading, error } = useQuery({
    queryKey: ["robots-rules"],
    queryFn: () => load({ data: undefined }),
  });

  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [robotsTxt, setRobotsTxt] = useState("");
  const [sitemapXml, setSitemapXml] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setText(data.text);
    setRobotsTxt(data.robotsTxt);
    setSitemapXml(data.sitemapXml);
  }, [data]);

  const runPreview = async () => {
    setBusy(true);
    try {
      const res = await preview({ data: { text } });
      setErrors(res.errors);
      setRobotsTxt(res.robotsTxt);
      setSitemapXml(res.sitemapXml);
    } finally {
      setBusy(false);
    }
  };

  const runSave = async () => {
    setBusy(true);
    try {
      const res = await save({ data: { text } });
      setErrors(res.errors);
      setRobotsTxt(res.robotsTxt);
      setSitemapXml(res.sitemapXml);
      if (res.saved) toast.success("robots rules saved");
      else toast.error(res.errors[0] ?? "Could not save rules");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <header className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">robots.txt editor</h2>
        <p className="text-sm text-muted-foreground">
          Write <code>Allow:</code>, <code>Disallow:</code> and <code>Sitemap:</code>{" "}
          rules. These rules are the single source of truth for robots.txt,
          sitemap.xml, the noindex response headers and the build-time checker.
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

      {!isLoading && !error && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              aria-label="robots rules"
              className="min-h-[380px] font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={runPreview} variant="outline" disabled={busy}>
                Preview
              </Button>
              <Button onClick={runSave} disabled={busy || errors.length > 0}>
                Save rules
              </Button>
            </div>
            {errors.length > 0 && (
              <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            <section>
              <h2 className="mb-1 text-sm font-medium">robots.txt preview</h2>
              <pre className="max-h-[240px] overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                {robotsTxt}
              </pre>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-medium">sitemap.xml preview</h2>
              <pre className="max-h-[240px] overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                {sitemapXml}
              </pre>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
