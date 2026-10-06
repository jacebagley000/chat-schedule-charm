import { useEffect, useState } from "react";
import { createFileRoute, HeadContent, Link } from "@tanstack/react-router";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { listLeads, updateLeadFollowUp } from "@/lib/leads.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
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

export const Route = createFileRoute("/_authenticated/admin/leads")({
  head: () => ({
    meta: pageMeta({
      title: "Lead Inbox — FrontDesk AI",
      description: "Manage inbound leads from comparison pages.",
      path: "/admin/leads",
      noindex: true,
    }),
    links: [canonicalLink("/admin/leads")],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const fetchLeads = useServerFn(listLeads);
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["leads"],
    queryFn: () => fetchLeads({ data: undefined }),
  });

  const saveFollowUp = useServerFn(updateLeadFollowUp);
  const followUpMutation = useMutation({
    mutationFn: (vars: { id: string; followUpStatus: FollowUpStatus }) =>
      saveFollowUp({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Follow-up updated");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not update follow-up"),
  });

  const [filter, setFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  useEffect(() => {
    const channel = supabase
      .channel("leads")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["leads"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const leads = data?.leads ?? [];
  const normalizedFilter = filter.toLowerCase().trim();
  const filtered = leads.filter((l) => {
    if (sourceFilter !== "all" && (l.source ?? "organic") !== sourceFilter) return false;
    if (!normalizedFilter) return true;
    return [l.name, l.email, l.phone, l.business_name]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedFilter));
  });

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <HeadContent />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lead inbox</h1>
          <p className="text-sm text-muted-foreground">
            {leads.length} submission{leads.length === 1 ? "" : "s"} from comparison pages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Search leads..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 w-full sm:w-64"
          />
          <Button asChild variant="outline">
            <Link to="/admin/lead-followup">Follow-up emails</Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh leads"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading leads...</p>}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">Failed to load leads</p>
          <p className="text-sm">{error instanceof Error ? error.message : "Unknown error"}</p>
        </div>
      )}

      {!isLoading && !error && (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Preferred call</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead>Contacted</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell>{lead.email}</TableCell>
                  <TableCell>{lead.phone || "—"}</TableCell>
                  <TableCell>
                    {lead.preferred_call_time
                      ? format(new Date(lead.preferred_call_time), "MMM d, yyyy h:mm a")
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{lead.source_page}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(lead.status)}>{lead.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={lead.follow_up_status ?? "not_contacted"}
                      onValueChange={(value) =>
                        followUpMutation.mutate({
                          id: lead.id,
                          followUpStatus: value as FollowUpStatus,
                        })
                      }
                      disabled={followUpMutation.isPending}
                    >
                      <SelectTrigger className="h-8 w-[150px]" aria-label={`Follow-up status for ${lead.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FOLLOW_UP_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.contacted_at
                      ? format(new Date(lead.contacted_at), "MMM d, yyyy h:mm a")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(lead.created_at), "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    No leads found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

type FollowUpStatus =
  | "not_contacted"
  | "attempted"
  | "contacted"
  | "no_response"
  | "done";

const FOLLOW_UP_OPTIONS: { value: FollowUpStatus; label: string }[] = [
  { value: "not_contacted", label: "Not contacted" },
  { value: "attempted", label: "Attempted" },
  { value: "contacted", label: "Contacted" },
  { value: "no_response", label: "No response" },
  { value: "done", label: "Done" },
];

function statusVariant(status: string) {
  switch (status) {
    case "new":
      return "default" as const;
    case "contacted":
      return "secondary" as const;
    case "scheduled":
      return "outline" as const;
    case "converted":
      return "default" as const;
    case "closed":
      return "destructive" as const;
    default:
      return "default" as const;
  }
}
