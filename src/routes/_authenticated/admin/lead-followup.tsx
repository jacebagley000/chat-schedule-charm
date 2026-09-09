import { useEffect, useMemo, useState } from "react";
import { createFileRoute, HeadContent } from "@tanstack/react-router";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { toast } from "sonner";
import { Mail, RefreshCw, Send } from "lucide-react";
import {
  listFollowUpLeads,
  listLeadEmails,
  sendLeadFollowUpEmail,
  type FollowUpLead,
} from "@/lib/lead-followup.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/lead-followup")({
  head: () => ({
    meta: pageMeta({
      title: "Lead Follow-up — FrontDesk AI",
      description: "Send follow-up emails to comparison page leads.",
      path: "/admin/lead-followup",
      noindex: true,
    }),
    links: [canonicalLink("/admin/lead-followup")],
  }),
  component: LeadFollowUpPage,
});

function formatCallTime(value: string | null): string | null {
  if (!value) return null;
  return format(new Date(value), "EEEE, MMM d 'at' h:mm a");
}

function defaultSubject(lead: FollowUpLead): string {
  return lead.preferred_call_time
    ? `Your FrontDesk AI call — ${format(new Date(lead.preferred_call_time), "MMM d 'at' h:mm a")}`
    : "Following up on your FrontDesk AI demo request";
}

function defaultBody(lead: FollowUpLead): string {
  const when = formatCallTime(lead.preferred_call_time);
  const greeting = `Hi ${lead.name.split(" ")[0] || lead.name},`;
  const middle = when
    ? `Thanks for requesting a demo of FrontDesk AI. You told us ${when} works best for a call — I've held that slot for you. Just reply to confirm and I'll send an invite.`
    : `Thanks for requesting a demo of FrontDesk AI. I'd love to show you how it answers calls and books appointments for ${
        lead.business_name || "your business"
      }. What time works best for a quick call this week?`;

  return `${greeting}\n\n${middle}\n\nTalk soon,\nThe FrontDesk AI team`;
}

function LeadFollowUpPage() {
  const fetchLeads = useServerFn(listFollowUpLeads);
  const fetchLeadEmails = useServerFn(listLeadEmails);
  const sendEmail = useServerFn(sendLeadFollowUpEmail);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["followup-leads"],
    queryFn: () => fetchLeads({ data: undefined }),
  });

  const leads = useMemo(() => data?.leads ?? [], [data]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const selected = leads.find((l) => l.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && leads.length > 0) setSelectedId(leads[0]!.id);
  }, [leads, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setSubject(defaultSubject(selected));
    setBody(defaultBody(selected));
  }, [selected?.id]);

  const history = useQuery({
    queryKey: ["followup-emails", selectedId],
    queryFn: () => fetchLeadEmails({ data: { leadId: selectedId! } }),
    enabled: Boolean(selectedId),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendEmail({ data: { leadId: selectedId!, subject, body } }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(`Email sent to ${selected?.email}`);
        queryClient.invalidateQueries({ queryKey: ["followup-leads"] });
        queryClient.invalidateQueries({ queryKey: ["followup-emails", selectedId] });
        queryClient.invalidateQueries({ queryKey: ["leads"] });
      } else {
        toast.error(result.error ?? "The email could not be sent");
        queryClient.invalidateQueries({ queryKey: ["followup-emails", selectedId] });
      }
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "The email could not be sent"),
  });

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <HeadContent />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lead follow-up</h1>
          <p className="text-sm text-muted-foreground">
            Send a real email to a lead about their preferred call time.
          </p>
        </div>
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

      {isLoading && <p className="text-muted-foreground">Loading leads...</p>}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">Failed to load leads</p>
          <p className="text-sm">{error instanceof Error ? error.message : "Unknown error"}</p>
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leads</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Preferred call</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead>Last email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      onClick={() => setSelectedId(lead.id)}
                      data-state={lead.id === selectedId ? "selected" : undefined}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <div className="font-medium">{lead.name}</div>
                        <div className="text-xs text-muted-foreground">{lead.email}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatCallTime(lead.preferred_call_time) ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {lead.follow_up_status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.last_email_at
                          ? format(new Date(lead.last_email_at), "MMM d, h:mm a")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {leads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No leads yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                {selected ? `Email ${selected.name}` : "Select a lead"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected && (
                <p className="text-sm text-muted-foreground">
                  Pick a lead on the left to write their follow-up.
                </p>
              )}
              {selected && (
                <>
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">To: </span>
                      {selected.email}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Preferred call: </span>
                      {formatCallTime(selected.preferred_call_time) ?? "not provided"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="followup-subject">Subject</Label>
                    <Input
                      id="followup-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="followup-body">Message</Label>
                    <Textarea
                      id="followup-body"
                      rows={10}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => sendMutation.mutate()}
                      disabled={
                        sendMutation.isPending || !subject.trim() || !body.trim()
                      }
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {sendMutation.isPending ? "Sending..." : "Send email"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSubject(defaultSubject(selected));
                        setBody(defaultBody(selected));
                      }}
                    >
                      Reset draft
                    </Button>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <p className="text-sm font-medium">Sent history</p>
                    {(history.data?.emails ?? []).length === 0 && (
                      <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
                    )}
                    <ul className="space-y-2">
                      {(history.data?.emails ?? []).map((mail: any) => (
                        <li key={mail.id} className="rounded-md border p-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{mail.subject}</span>
                            <Badge variant={mail.ok ? "secondary" : "destructive"}>
                              {mail.ok ? "sent" : "failed"}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(mail.created_at), "MMM d, yyyy h:mm a")}
                            {mail.error ? ` — ${mail.error}` : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
