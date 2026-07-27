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
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, UserPlus, Trash2, Users, Loader2, Shield, Clock, X, Mail, RefreshCw, Copy, AlertTriangle } from "lucide-react";

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

type Invitation = {
  id: string;
  email: string;
  role: Role;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  last_sent_at: string;
  send_count: number;
  created_at: string;
  is_expired: boolean;
  invited_by_name: string | null;
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

// A member is "invited" until they've signed in and their profile has been created
// (name/avatar) OR the row is older than an activation grace window. Anyone with
// recorded activity, a display name, or an avatar is considered active.
function deriveStatus(m: Member, lastActivityAt?: string): "invited" | "active" {
  if (lastActivityAt) return "active";
  if (m.full_name || m.avatar_url) return "active";
  const ageMs = Date.now() - new Date(m.created_at).getTime();
  return ageMs < 1000 * 60 * 60 * 24 * 7 ? "invited" : "active";
}

function StatusBadge({ member, lastActivityAt }: { member: Member; lastActivityAt?: string }) {
  const status = deriveStatus(member, lastActivityAt);
  const cls = status === "invited"
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  return (
    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${cls}`}>
      {status}
    </span>
  );
}

function formatRelative(iso?: string): string {
  if (!iso) return "No activity yet";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<Role>("staff");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invPending, setInvPending] = useState<Record<string, boolean>>({});
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);
  const [inviteLink, setInviteLink] = useState<{ email: string; url: string } | null>(null);

  const currentMember = useMemo(
    () => members.find((m) => m.user_id === user?.id) ?? null,
    [members, user?.id],
  );
  const canManage = currentMember?.role === "owner" || currentMember?.role === "admin";
  const ownerCount = useMemo(() => members.filter((m) => m.role === "owner").length, [members]);

  const load = async () => {
    setLoading(true);
    const [{ data: biz }, membersRes, activityRes, invitesRes] = await Promise.all([
      supabase.from("businesses").select("name").eq("id", businessId).maybeSingle(),
      supabase.rpc("list_business_members", { _business_id: businessId }),
      supabase
        .from("audit_logs")
        .select("actor_user_id, created_at")
        .eq("business_id", businessId)
        .not("actor_user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.rpc("list_business_invitations", { _business_id: businessId }),
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
    if (invitesRes.error) {
      // Non-fatal — the members list can still show.
      console.warn("Failed to load invitations:", invitesRes.error.message);
      setInvitations([]);
    } else {
      setInvitations((invitesRes.data ?? []) as Invitation[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [businessId]);

  const buildInviteUrl = (token: string) =>
    `${window.location.origin}/invite/${token}`;

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setAdding(true);
    const { data, error } = await supabase.rpc("create_business_invitation", {
      _business_id: businessId,
      _email: addEmail.trim(),
      _role: addRole,
    });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const token: string | undefined = row?.token;
    const email = addEmail.trim();
    setAddEmail("");
    setAddRole("staff");
    setAddOpen(false);
    if (token) {
      const url = buildInviteUrl(token);
      setInviteLink({ email, url });
    }
    toast.success(`Invitation created for ${email}`);
    load();
  };

  const handleResend = async (inv: Invitation) => {
    setInvPending((p) => ({ ...p, [inv.id]: true }));
    const { data, error } = await supabase.rpc("resend_business_invitation", {
      _invitation_id: inv.id,
    });
    setInvPending((p) => ({ ...p, [inv.id]: false }));
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const token: string | undefined = row?.token;
    if (token) {
      setInviteLink({ email: inv.email, url: buildInviteUrl(token) });
    }
    toast.success(`Invitation resent to ${inv.email} — expires in 7 days`);
    load();
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    const target = revokeTarget;
    setInvPending((p) => ({ ...p, [target.id]: true }));
    const { error } = await supabase.rpc("revoke_business_invitation", {
      _invitation_id: target.id,
    });
    setInvPending((p) => ({ ...p, [target.id]: false }));
    setRevokeTarget(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Revoked invitation for ${target.email}`);
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

  // Members eligible for bulk selection: exclude self and (when only one owner remains)
  // that last owner, since demoting them would violate the ownership invariant.
  const selectableMembers = useMemo(
    () => members.filter((m) => {
      if (m.user_id === user?.id) return false;
      if (m.role === "owner" && ownerCount <= 1) return false;
      return true;
    }),
    [members, user?.id, ownerCount],
  );
  const selectedMembers = useMemo(
    () => members.filter((m) => selectedIds.has(m.id)),
    [members, selectedIds],
  );
  const allSelectableChecked =
    selectableMembers.length > 0 && selectableMembers.every((m) => selectedIds.has(m.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (allSelectableChecked) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableMembers.map((m) => m.id)));
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkRoleApply = async () => {
    const targets = selectedMembers.filter((m) => m.role !== bulkRole);
    if (targets.length === 0) {
      toast.info("Selected members are already that role.");
      setBulkConfirmOpen(false);
      return;
    }
    // Guard: after applying, at least one owner must remain.
    const remainingOwners =
      ownerCount
      - targets.filter((m) => m.role === "owner").length
      + (bulkRole === "owner" ? targets.filter((m) => m.role !== "owner").length : 0);
    if (remainingOwners < 1) {
      toast.error("You can't demote the last owner. Promote someone else first.");
      setBulkConfirmOpen(false);
      return;
    }
    setBulkApplying(true);
    const ids = targets.map((m) => m.id);
    const { error } = await supabase
      .from("business_members")
      .update({ role: bulkRole })
      .in("id", ids);
    setBulkApplying(false);
    setBulkConfirmOpen(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Updated ${ids.length} member${ids.length === 1 ? "" : "s"} to ${ROLE_LABELS[bulkRole]}`);
    clearSelection();
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
                    <DialogTitle>Invite a team member</DialogTitle>
                    <DialogDescription>
                      We'll create an invitation link — valid for 7 days. Once your email
                      domain is verified we also email it to them automatically.
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
          <>
            {canManage && (
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={allSelectableChecked}
                    onCheckedChange={toggleSelectAll}
                    disabled={selectableMembers.length === 0}
                    aria-label="Select all members"
                  />
                  <Label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                    {selectedIds.size > 0
                      ? `${selectedIds.size} selected`
                      : `Select all (${selectableMembers.length})`}
                  </Label>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Label htmlFor="bulk-role" className="text-sm text-muted-foreground">Set role to</Label>
                  <Select value={bulkRole} onValueChange={(v) => setBulkRole(v as Role)}>
                    <SelectTrigger id="bulk-role" className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={selectedIds.size === 0 || bulkApplying}
                    onClick={() => setBulkConfirmOpen(true)}
                  >
                    {bulkApplying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Apply
                  </Button>
                  {selectedIds.size > 0 && (
                    <Button size="sm" variant="ghost" onClick={clearSelection} title="Clear selection">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {members.map((m) => {
                const isSelf = m.user_id === user?.id;
                const isLastOwner = m.role === "owner" && ownerCount <= 1;
                const busy = !!pending[m.id];
                const isSelectable = canManage && !isSelf && !(m.role === "owner" && ownerCount <= 1);
                const isSelected = selectedIds.has(m.id);
                return (
                  <li key={m.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                    {canManage && (
                      <Checkbox
                        checked={isSelected}
                        disabled={!isSelectable}
                        onCheckedChange={() => toggleSelect(m.id)}
                        aria-label={`Select ${m.full_name || m.email || "member"}`}
                        title={
                          !isSelectable
                            ? isSelf
                              ? "You can't bulk-edit yourself"
                              : "You can't demote the last owner"
                            : undefined
                        }
                      />
                    )}
                  <button
                    type="button"
                    className="flex items-center gap-4 flex-1 min-w-0 text-left"
                    onClick={() => setDetailsFor(m)}
                  >
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
                        <StatusBadge member={m} lastActivityAt={lastActivity[m.user_id]} />
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{m.email || "—"}</div>
                    </div>
                  </button>
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
          </>
        )}
      </main>

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change {selectedIds.size} member{selectedIds.size === 1 ? "" : "s"} to {ROLE_LABELS[bulkRole]}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This updates roles for everyone selected. Members already assigned to
              {" "}{ROLE_LABELS[bulkRole]} won't change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkApplying}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkRoleApply} disabled={bulkApplying}>
              {bulkApplying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <Sheet open={!!detailsFor} onOpenChange={(o) => !o && setDetailsFor(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {detailsFor && (
            <>
              <SheetHeader>
                <SheetTitle>Member details</SheetTitle>
                <SheetDescription>Overview of this member's access and recent activity.</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-medium overflow-hidden shrink-0">
                    {detailsFor.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={detailsFor.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initials(detailsFor.full_name, detailsFor.email)
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {detailsFor.full_name || detailsFor.email || "Unknown"}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{detailsFor.email || "—"}</div>
                  </div>
                </div>

                <dl className="grid grid-cols-3 gap-3 text-sm">
                  <dt className="col-span-1 text-muted-foreground">Role</dt>
                  <dd className="col-span-2 font-medium">{ROLE_LABELS[detailsFor.role]}</dd>

                  <dt className="col-span-1 text-muted-foreground">Status</dt>
                  <dd className="col-span-2">
                    <StatusBadge member={detailsFor} lastActivityAt={lastActivity[detailsFor.user_id]} />
                  </dd>

                  <dt className="col-span-1 text-muted-foreground">Joined</dt>
                  <dd className="col-span-2">
                    {new Date(detailsFor.created_at).toLocaleDateString(undefined, {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </dd>

                  <dt className="col-span-1 text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Last activity
                  </dt>
                  <dd className="col-span-2">
                    {formatRelative(lastActivity[detailsFor.user_id])}
                    {lastActivity[detailsFor.user_id] && (
                      <div className="text-xs text-muted-foreground">
                        {new Date(lastActivity[detailsFor.user_id]).toLocaleString()}
                      </div>
                    )}
                  </dd>
                </dl>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
