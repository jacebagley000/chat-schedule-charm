import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { ArrowLeft, UserPlus, Trash2, Users, Loader2, Shield, Clock } from "lucide-react";

type Role = "owner" | "admin" | "staff";

type Member = {
  id: string;
  user_id: string;
  role: Role;
  created_at: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export const Route = createFileRoute("/_authenticated/workspaces/$businessId/members")({
  component: MembersPage,
  head: () => ({
    meta: [
      { title: "Team members — FrontDesk AI" },
      { name: "description", content: "Manage who has access to your workspace and their role." },
    ],
  }),
});

function initials(name: string | null, email: string | null) {
  const source = (name?.trim() || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return chars.toUpperCase();
}

const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

function MembersPage() {
  const { businessId } = useParams({ from: "/_authenticated/workspaces/$businessId/members" });
  const { user } = useAuth();
  const [businessName, setBusinessName] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<Role>("staff");
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [detailsFor, setDetailsFor] = useState<Member | null>(null);
  const [lastActivity, setLastActivity] = useState<Record<string, string>>({});

  const currentMember = useMemo(
    () => members.find((m) => m.user_id === user?.id) ?? null,
    [members, user?.id],
  );
  const canManage = currentMember?.role === "owner" || currentMember?.role === "admin";
  const ownerCount = useMemo(() => members.filter((m) => m.role === "owner").length, [members]);

  const load = async () => {
    setLoading(true);
    const [{ data: biz }, membersRes, activityRes] = await Promise.all([
      supabase.from("businesses").select("name").eq("id", businessId).maybeSingle(),
      supabase.rpc("list_business_members", { _business_id: businessId }),
      supabase
        .from("audit_logs")
        .select("actor_user_id, created_at")
        .eq("business_id", businessId)
        .not("actor_user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (biz?.name) setBusinessName(biz.name);
    if (membersRes.error) {
      toast.error(membersRes.error.message);
      setMembers([]);
    } else {
      setMembers((membersRes.data ?? []) as Member[]);
    }
    const activityMap: Record<string, string> = {};
    for (const row of (activityRes.data ?? []) as { actor_user_id: string; created_at: string }[]) {
      if (row.actor_user_id && !activityMap[row.actor_user_id]) {
        activityMap[row.actor_user_id] = row.created_at;
      }
    }
    setLastActivity(activityMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, [businessId]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setAdding(true);
    const { error } = await supabase.rpc("add_business_member_by_email", {
      _business_id: businessId,
      _email: addEmail.trim(),
      _role: addRole,
    });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Added ${addEmail.trim()} as ${ROLE_LABELS[addRole]}`);
    setAddEmail("");
    setAddRole("staff");
    setAddOpen(false);
    load();
  };

  const handleRoleChange = async (member: Member, next: Role) => {
    if (member.role === next) return;
    // Prevent demoting the last owner.
    if (member.role === "owner" && next !== "owner" && ownerCount <= 1) {
      toast.error("You can't remove the last owner. Promote someone else first.");
      return;
    }
    setPending((p) => ({ ...p, [member.id]: true }));
    const { error } = await supabase
      .from("business_members")
      .update({ role: next })
      .eq("id", member.id);
    setPending((p) => ({ ...p, [member.id]: false }));
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Updated ${member.full_name || member.email || "member"} to ${ROLE_LABELS[next]}`);
    load();
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    const target = removeTarget;
    if (target.role === "owner" && ownerCount <= 1) {
      toast.error("You can't remove the last owner.");
      setRemoveTarget(null);
      return;
    }
    setPending((p) => ({ ...p, [target.id]: true }));
    const { error } = await supabase
      .from("business_members")
      .delete()
      .eq("id", target.id);
    setPending((p) => ({ ...p, [target.id]: false }));
    setRemoveTarget(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Removed ${target.full_name || target.email || "member"}`);
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard"><ArrowLeft className="w-4 h-4 mr-1" /> Workspaces</Link>
            </Button>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Admin</div>
              <div className="font-serif text-lg truncate">{businessName || "Workspace"} · Members</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/workspaces/$businessId/calendar" params={{ businessId }}>Calendar</Link>
            </Button>
            {canManage && (
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><UserPlus className="w-4 h-4 mr-1" /> Add member</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add a team member</DialogTitle>
                    <DialogDescription>
                      They must already have a FrontDesk AI account. Ask them to sign up first if
                      you can't find their email.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAdd} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="member-email">Email</Label>
                      <Input
                        id="member-email"
                        type="email"
                        required
                        placeholder="teammate@example.com"
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="member-role">Role</Label>
                      <Select value={addRole} onValueChange={(v) => setAddRole(v as Role)}>
                        <SelectTrigger id="member-role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff — day-to-day access</SelectItem>
                          <SelectItem value="admin">Admin — manage settings and team</SelectItem>
                          <SelectItem value="owner">Owner — full control</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="ghost" onClick={() => setAddOpen(false)} disabled={adding}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={adding}>
                        {adding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Add member
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <Shield className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            {canManage ? (
              <>You can invite people, change roles, and remove members. Owners keep permanent access
              — you can't remove the last owner.</>
            ) : (
              <>Only owners and admins can change team access. Contact an admin to update your role.</>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading team…
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No members yet.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {members.map((m) => {
              const isSelf = m.user_id === user?.id;
              const isLastOwner = m.role === "owner" && ownerCount <= 1;
              const busy = !!pending[m.id];
              return (
                <li key={m.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium overflow-hidden shrink-0">
                    {m.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initials(m.full_name, m.email)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate flex items-center gap-2">
                      {m.full_name || m.email || "Unknown"}
                      {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{m.email || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage ? (
                      <Select
                        value={m.role}
                        disabled={busy || (isLastOwner && m.role === "owner")}
                        onValueChange={(v) => handleRoleChange(m, v as Role)}
                      >
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="owner">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm px-2.5 py-1 rounded-md bg-muted">{ROLE_LABELS[m.role]}</span>
                    )}
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy || isLastOwner}
                        title={isLastOwner ? "Can't remove the last owner" : "Remove member"}
                        onClick={() => setRemoveTarget(m)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.full_name || removeTarget?.email || "This person"} will lose access
              to the workspace immediately. You can add them back anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
