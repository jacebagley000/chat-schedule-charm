import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  getCrawlAlertConfig,
  runCrawlAlertCheck,
  saveCrawlAlertConfig,
  sendCrawlAlertTest,
} from "@/lib/crawl-alerts.functions";

const REASON_TEXT: Record<string, string> = {
  disabled: "Alerts are off — nothing was sent.",
  "no-recipient": "Add an email address to receive alerts.",
  healthy: "Everything passed — no alert needed.",
  throttled: "Problems found, but an alert was sent recently.",
  unchanged: "Same problems as the last alert — not re-sent.",
  "send-failed": "The alert email could not be sent.",
};

/**
 * Live crawl health alerts: emails the configured address whenever robots.txt,
 * sitemap.xml or any allowlisted URL fails, throttled to avoid repeat mails.
 *
 * `failuresPresent` comes from the dashboard's own status query, so an alert is
 * only attempted when the visible report is already failing.
 */
export function CrawlAlertPanel({
  failuresPresent,
  checkedAt,
}: {
  failuresPresent: boolean;
  checkedAt?: string;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(getCrawlAlertConfig);
  const save = useServerFn(saveCrawlAlertConfig);
  const runCheck = useServerFn(runCrawlAlertCheck);
  const sendTest = useServerFn(sendCrawlAlertTest);

  const { data, isLoading } = useQuery({
    queryKey: ["crawl-alert-config"],
    queryFn: () => load(),
    retry: false,
  });

  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [interval, setIntervalMinutes] = useState(60);
  const [lastRun, setLastRun] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setEmail(data.settings.recipientEmail);
    setEnabled(data.settings.enabled);
    setIntervalMinutes(data.settings.minIntervalMinutes);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: { recipientEmail: email, enabled, minIntervalMinutes: interval },
      }),
    onSuccess: () => {
      toast.success("Alert settings saved");
      queryClient.invalidateQueries({ queryKey: ["crawl-alert-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMutation = useMutation({
    mutationFn: () => sendTest(),
    onSuccess: (result) => {
      if (result.ok) toast.success(`Test alert sent to ${email}`);
      else toast.error(result.error ?? "Test alert failed");
      queryClient.invalidateQueries({ queryKey: ["crawl-alert-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alertMutation = useMutation({
    mutationFn: () => runCheck(),
    onSuccess: (result) => {
      setLastRun(
        result.sent
          ? `Alert emailed for ${result.failures.length} problem${
              result.failures.length === 1 ? "" : "s"
            }.`
          : (REASON_TEXT[result.reason ?? ""] ?? "No alert sent."),
      );
      if (result.reason === "send-failed" && result.error) toast.error(result.error);
      queryClient.invalidateQueries({ queryKey: ["crawl-alert-config"] });
    },
    onError: (e: Error) => setLastRun(e.message),
  });

  // Auto-alert: whenever the dashboard's latest check shows failures and alerts
  // are on, ask the server to verify and (if warranted) email.
  const alertMutate = alertMutation.mutate;
  useEffect(() => {
    if (!data?.settings.enabled || !failuresPresent || !checkedAt) return;
    alertMutate();
  }, [data?.settings.enabled, failuresPresent, checkedAt, alertMutate]);

  const events = data?.events ?? [];

  return (
    <section className="mb-6 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Crawl health alerts</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Email me when robots.txt, sitemap.xml or any allowlisted URL fails.
          </p>
        </div>
        <Badge variant={data?.settings.enabled ? "secondary" : "outline"}>
          {isLoading ? "Loading…" : data?.settings.enabled ? "On" : "Off"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <div>
          <Label htmlFor="crawl-alert-email" className="text-xs">
            Send alerts to
          </Label>
          <Input
            id="crawl-alert-email"
            type="email"
            value={email}
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="crawl-alert-interval" className="text-xs">
            Minimum minutes between alerts
          </Label>
          <Input
            id="crawl-alert-interval"
            type="number"
            min={5}
            max={1440}
            value={interval}
            onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            className="mt-1"
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch id="crawl-alert-enabled" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="crawl-alert-enabled" className="text-xs">
            Enabled
          </Label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Saving…" : "Save"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending || !data?.settings.recipientEmail}
        >
          {testMutation.isPending ? "Sending…" : "Send test email"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => alertMutation.mutate()}
          disabled={alertMutation.isPending}
        >
          {alertMutation.isPending ? "Checking…" : "Check now & alert"}
        </Button>
        {lastRun && <span className="text-xs text-muted-foreground">{lastRun}</span>}
      </div>

      {data?.settings.lastAlertAt && (
        <p className="mt-3 text-xs text-muted-foreground">
          Last alert sent {new Date(data.settings.lastAlertAt).toLocaleString()}.
        </p>
      )}

      {events.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {events.map((e) => (
            <li key={e.id} className={e.ok ? "text-muted-foreground" : "text-destructive"}>
              {e.ok ? "✓" : "✗"} {new Date(e.createdAt).toLocaleString()} ·{" "}
              {e.kind === "test" ? "test" : `${e.failureCount} problem(s)`} → {e.recipientEmail}
              {e.error ? ` — ${e.error}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
