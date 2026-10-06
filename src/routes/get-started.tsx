import { useState, type FormEvent } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { pageMeta, absoluteUrl } from "@/lib/seo";
import { MarketingShell } from "@/components/MarketingShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const INDUSTRIES = ["Salon", "Barbershop", "Clinic / wellness", "Home services", "Other"];

export const Route = createFileRoute("/get-started")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: pageMeta({
      title: "Create a business account — FrontDesk AI",
      description: "Sign up your business for FrontDesk AI and get a workspace with your calendar, staff and services ready to go.",
      path: "/get-started",
    }),
    links: [{ rel: "canonical", href: absoluteUrl("/get-started") }],
  }),
  component: BusinessSignupPage,
});

function BusinessSignupPage() {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", businessName: "", industry: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: form.fullName.trim(),
          business_name: form.businessName.trim(),
          business_industry: form.industry,
          business_phone: form.phone.trim(),
          business_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) return window.location.assign("/dashboard");
    setSentTo(form.email.trim());
  };

  return (
    <MarketingShell>
      <main className="mx-auto max-w-xl px-6 py-16">
        {sentTo ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <h1 className="mb-3 font-serif text-4xl">Check your inbox</h1>
            <p className="text-muted-foreground">
              We sent a confirmation link to <strong className="text-foreground">{sentTo}</strong>. Click it and you'll land in your
              new <strong className="text-foreground">{form.businessName}</strong> workspace.
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-border bg-card p-8">
            <h1 className="mb-1 font-serif text-4xl">Create your business account</h1>
            <p className="mb-6 text-muted-foreground">Free to set up. You only pay when you choose a plan.</p>
            <form onSubmit={submit} className="space-y-4">
              <fieldset className="space-y-4">
                <legend className="mb-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">Your business</legend>
                <div className="space-y-2"><Label htmlFor="biz">Business name</Label><Input id="biz" required maxLength={120} value={form.businessName} onChange={set("businessName")} /></div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <select id="industry" value={form.industry} onChange={set("industry")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Choose one</option>
                    {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </div>
                <div className="space-y-2"><Label htmlFor="phone">Business phone (optional)</Label><Input id="phone" type="tel" maxLength={40} value={form.phone} onChange={set("phone")} /></div>
              </fieldset>
              <fieldset className="space-y-4 border-t border-border pt-4">
                <legend className="mb-2 pt-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">You</legend>
                <div className="space-y-2"><Label htmlFor="name">Your name</Label><Input id="name" required maxLength={100} value={form.fullName} onChange={set("fullName")} /></div>
                <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={form.email} onChange={set("email")} /></div>
                <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" required minLength={8} value={form.password} onChange={set("password")} /></div>
              </fieldset>
              <Button type="submit" disabled={loading} className="w-full">{loading ? "Creating…" : "Create business account"}</Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account? <Link to="/login" className="text-foreground underline">Sign in</Link>
            </p>
          </div>
        )}
      </main>
    </MarketingShell>
  );
}
