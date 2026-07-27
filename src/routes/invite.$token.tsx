import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Mail, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
  head: () => ({
    meta: [
      { title: "Accept invitation — FrontDesk AI" },
      { name: "description", content: "Join a workspace on FrontDesk AI." },
    ],
  }),
});

type AcceptedInvite = { business_id: string; business_name: string; role: string };

function InvitePage() {
  const { token } = useParams({ from: "/invite/$token" });
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<AcceptedInvite | null>(null);
  const [autoTried, setAutoTried] = useState(false);

  const doAccept = async () => {
    setAccepting(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("accept_business_invitation", {
      _token: token,
    });
    setAccepting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      setAccepted(row as AcceptedInvite);
      toast.success(`Joined ${row.business_name}`);
    }
  };

  // Auto-accept once when the user is signed in.
  useEffect(() => {
    if (!authLoading && user && !accepted && !autoTried && !accepting) {
      setAutoTried(true);
      doAccept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, autoTried]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mx-auto mb-4">
          <Mail className="w-6 h-6 text-accent" />
        </div>
        <h1 className="font-serif text-2xl text-center mb-2">Workspace invitation</h1>

        {accepted ? (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">You're in!</span>
            </div>
            <p className="text-sm text-muted-foreground">
              You joined <strong>{accepted.business_name}</strong> as {accepted.role}.
            </p>
            <Button
              className="w-full"
              onClick={() =>
                navigate({
                  to: "/workspaces/$businessId/calendar",
                  params: { businessId: accepted.business_id },
                })
              }
            >
              Open workspace
            </Button>
          </div>
        ) : authLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Checking your session…
          </div>
        ) : !user ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Sign in with the email address that received this invitation to accept it.
            </p>
            <Button asChild className="w-full">
              <Link
                to="/login"
                search={{ redirect: `/invite/${token}` }}
              >
                Sign in
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link
                to="/signup"
                search={{ redirect: `/invite/${token}` }}
              >
                Create account
              </Link>
            </Button>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/login" }))}
              >
                Switch account
              </Button>
              <Button className="flex-1" onClick={doAccept} disabled={accepting}>
                {accepting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Try again
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Accepting invitation…
          </div>
        )}
      </div>
    </div>
  );
}
