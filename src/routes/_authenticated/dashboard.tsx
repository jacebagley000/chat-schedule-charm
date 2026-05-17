import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, Plus, LogOut, Phone, Calendar, MessageSquare, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [{ title: "Dashboard — FrontDesk AI" }],
  }),
});

type Business = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  phone: string | null;
};

function DashboardPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, slug, industry, phone")
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setBusinesses((data ?? []) as Business[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-serif text-xl tracking-tight">
            FrontDesk <span className="text-accent">AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl tracking-tight">Your workspaces</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Each workspace is a business with its own phone line, calendar, and inbox.
            </p>
          </div>
          <CreateBusinessDialog onCreated={load} />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : businesses.length === 0 ? (
          <EmptyState onCreated={load} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((b) => (
              <div key={b.id} className="rounded-xl border border-border bg-card p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                    <Building2 className="h-5 w-5" />
                  </div>
                  {b.industry && (
                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      {b.industry}
                    </span>
                  )}
                </div>
                <h3 className="font-serif text-xl mb-1">{b.name}</h3>
                <p className="text-xs font-mono text-muted-foreground mb-4">/{b.slug}</p>
                <div className="grid grid-cols-4 gap-2 text-center pt-4 border-t border-border">
                  <Stat icon={<Phone className="h-4 w-4" />} label="Calls" />
                  <Stat icon={<MessageSquare className="h-4 w-4" />} label="DMs" />
                  <Stat icon={<Calendar className="h-4 w-4" />} label="Today" />
                  <Stat icon={<Users className="h-4 w-4" />} label="Staff" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-muted-foreground">
      {icon}
      <span className="text-[10px] uppercase tracking-wide">{label}</span>
    </div>
  );
}

function EmptyState({ onCreated }: { onCreated: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-12 text-center">
      <Building2 className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
      <h3 className="font-serif text-xl mb-2">Create your first workspace</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
        Set up a business so we can start handling its calls, DMs, and bookings.
      </p>
      <CreateBusinessDialog onCreated={onCreated} />
    </div>
  );
}

function CreateBusinessDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from("businesses").insert({
      name, slug, industry: industry || null, phone: phone || null, created_by: user.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Workspace created");
    setOpen(false);
    setName(""); setIndustry(""); setPhone("");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> New workspace</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">New workspace</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bname">Business name</Label>
            <Input id="bname" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Hair Studio" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Hair salon" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Business phone</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create workspace"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
