import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Trash2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/workspaces/$businessId/audit")({
  component: AuditPage,
  head: () => ({ meta: [{ title: "Audit log — FrontDesk AI" }] }),
});

type AuditRow = {
  id: string;
  business_id: string;
  actor_user_id: string | null;
  actor_type: "user" | "webhook" | "system";
  actor_label: string | null;
  action: string;
  entity_type: "appointment" | "scheduling_request" | "conversation" | "message";
  entity_id: string | null;
  channel: string | null;
  summary: string | null;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const PAGE_SIZE = 50;

function AuditPage() {
  const { businessId } = Route.useParams();
  const { user } = useAuth();

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const [actorType, setActorType] = useState<string>("any");
  const [entityType, setEntityType] = useState<string>("any");
  const [channel, setChannel] = useState<string>("any");
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [purgeBefore, setPurgeBefore] = useState("");
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("business_members")
      .select("role")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsOwnerOrAdmin(data?.role === "owner" || data?.role === "admin");
      });
  }, [user, businessId]);

  const load = async (append = false) => {
    setLoading(true);
    let query = supabase
      .from("audit_logs")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (actorType !== "any") query = query.eq("actor_type", actorType);
    if (entityType !== "any") query = query.eq("entity_type", entityType);
    if (channel !== "any") query = query.eq("channel", channel);
    if (q.trim()) query = query.ilike("summary", `%${q.trim()}%`);
    if (fromDate) query = query.gte("created_at", new Date(fromDate).toISOString());
    if (toDate) {
      const end = new Date(toDate);
      end.setDate(end.getDate() + 1);
      query = query.lt("created_at", end.toISOString());
    }
    if (append && rows.length > 0) {
      query = query.lt("created_at", rows[rows.length - 1].created_at);
    }

    const { data, error } = await query;
    setLoading(false);
    if (error) return toast.error(error.message);
    const list = (data ?? []) as AuditRow[];
    setHasMore(list.length > PAGE_SIZE);
    const trimmed = list.slice(0, PAGE_SIZE);
    setRows(append ? [...rows, ...trimmed] : trimmed);
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, actorType, entityType, channel, fromDate, toDate]);

  const filteredCount = rows.length;

  const purge = async () => {
    if (!purgeBefore) return;
    const iso = new Date(purgeBefore).toISOString();
    const { error, count } = await supabase
      .from("audit_logs")
      .delete({ count: "exact" })
      .eq("business_id", businessId)
      .lt("created_at", iso);
    if (error) return toast.error(error.message);
    toast.success(`Removed ${count ?? 0} entries`);
    setPurgeBefore("");
    load(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <span className="font-serif text-lg">Audit log</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <div className="rounded-xl border border-border bg-card p-4 grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <Label className="text-xs">Search summary</Label>
            <div className="flex gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") load(false); }}
                placeholder="e.g. rescheduled, Instagram…"
              />
              <Button variant="secondary" onClick={() => load(false)}>Go</Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Actor</Label>
            <Select value={actorType} onValueChange={setActorType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="user">Team member</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Entity</Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="appointment">Appointment</SelectItem>
                <SelectItem value="scheduling_request">Scheduling request</SelectItem>
                <SelectItem value="message">Message</SelectItem>
                <SelectItem value="conversation">Conversation</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="ghost" onClick={() => load(false)} className="w-full">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          {isOwnerOrAdmin && (
            <div className="md:col-span-4 flex items-end justify-end gap-2">
              <div className="flex-1 max-w-xs">
                <Label className="text-xs">Delete entries before</Label>
                <Input type="date" value={purgeBefore} onChange={(e) => setPurgeBefore(e.target.value)} />
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={!purgeBefore}>
                    <Trash2 className="h-4 w-4" /> Purge
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete old audit entries?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes audit entries older than {purgeBefore}. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={purge}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">When</th>
                <th className="text-left px-4 py-2">Who</th>
                <th className="text-left px-4 py-2">Action</th>
                <th className="text-left px-4 py-2">Entity</th>
                <th className="text-left px-4 py-2">Channel</th>
                <th className="text-left px-4 py-2">Summary</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No entries match these filters.</td></tr>
              ) : rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer"
                  onClick={() => setDetail(r)}
                >
                  <td className="px-4 py-2 whitespace-nowrap font-mono text-xs">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col">
                      <span>{r.actor_label ?? "—"}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.actor_type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{r.action}</td>
                  <td className="px-4 py-2 text-xs">{r.entity_type}</td>
                  <td className="px-4 py-2 text-xs">{r.channel ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{r.summary ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {filteredCount} entr{filteredCount === 1 ? "y" : "ies"}</span>
          {hasMore && (
            <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={loading}>
              Load older
            </Button>
          )}
        </div>
      </main>

      <Sheet open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-serif">Audit entry</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="mt-4 space-y-4 text-sm">
              <DetailRow k="When" v={new Date(detail.created_at).toLocaleString()} />
              <DetailRow k="Actor" v={`${detail.actor_label ?? "—"} (${detail.actor_type})`} />
              <DetailRow k="Action" v={detail.action} />
              <DetailRow k="Entity" v={`${detail.entity_type}${detail.entity_id ? " · " + detail.entity_id : ""}`} />
              <DetailRow k="Channel" v={detail.channel ?? "—"} />
              <DetailRow k="Summary" v={detail.summary ?? "—"} />
              {detail.changes && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Changes</div>
                  <pre className="text-xs bg-muted rounded p-3 overflow-x-auto">{JSON.stringify(detail.changes, null, 2)}</pre>
                </div>
              )}
              {detail.metadata && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Metadata</div>
                  <pre className="text-xs bg-muted rounded p-3 overflow-x-auto">{JSON.stringify(detail.metadata, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="mt-1 break-words">{v}</div>
    </div>
  );
}
