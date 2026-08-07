import { useState } from "react";
import { createFileRoute, HeadContent } from "@tanstack/react-router";
import { pageMeta } from "@/lib/seo";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { listLeads } from "@/lib/leads.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const fetchLeads = useServerFn(listLeads);
  const { data, isLoading, error } = useQuery({
    queryKey: ["leads"],
    queryFn: () => fetchLeads({ data: undefined }),
  });

  const [filter, setFilter] = useState("");

  const leads = data?.leads ?? [];
  const filtered = filter
    ? leads.filter(
        (l) =>
          l.name.toLowerCase().includes(filter.toLowerCase()) ||
          l.email.toLowerCase().includes(filter.toLowerCase()) ||
          (l.business_name?.toLowerCase().includes(filter.toLowerCase()) ?? false)
      )
    : leads;

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
        <input
          type="text"
          placeholder="Search leads..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
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
                <TableHead>Business</TableHead>
                <TableHead>Preferred call</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell>{lead.email}</TableCell>
                  <TableCell>{lead.business_name || "—"}</TableCell>
                  <TableCell>
                    {lead.preferred_call_time
                      ? format(new Date(lead.preferred_call_time), "MMM d, yyyy h:mm a")
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{lead.source_page}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(lead.status)}>{lead.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(lead.created_at), "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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
