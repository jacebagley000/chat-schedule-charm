import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { brandJsonLd } from "@/lib/structured-data";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string; plan?: string } => ({
    ...(typeof search.redirect === "string" ? { redirect: search.redirect } : {}),
    ...(typeof search.plan === "string" ? { plan: search.plan } : {}),
  }),

  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Create account — FrontDesk AI" },
      { name: "description", content: "Create your FrontDesk AI workspace in under a minute." },
      { property: "og:title", content: "Start your FrontDesk AI workspace" },
      {
        property: "og:description",
        content: "Set up your AI receptionist in under a minute. 14-day trial, no card required.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://chat-schedule-charm.lovable.app/signup" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://chat-schedule-charm.lovable.app/signup" }],
    scripts: [brandJsonLd()],
  }),

});

function SignupPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo, plan } = Route.useSearch();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // If a plan was selected on the pricing page, send the user to checkout
  // immediately after account creation. Otherwise honor `?redirect=` or dashboard.
  const target = plan
    ? `/checkout/start?plan=${encodeURIComponent(plan)}`
    : redirectTo && redirectTo.startsWith("/")
    ? redirectTo
    : "/dashboard";

  const goNext = () => {
    window.location.assign(target);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + target,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      goNext();
    } else {
      toast.success("Check your email to confirm your account, then you'll be sent to checkout.");
    }
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + target,
    });
    if (result.error) return toast.error("Google sign-in failed");
    if (result.redirected) return;
    goNext();
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="font-serif text-2xl tracking-tight block text-center mb-8">
          FrontDesk <span className="text-accent">AI</span>
        </Link>
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <h1 className="font-serif text-2xl mb-1">Create your workspace</h1>
          <p className="text-sm text-muted-foreground mb-6">14-day trial. No card required.</p>

          <Button onClick={handleGoogle} variant="outline" className="w-full mb-4">
            Continue with Google
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating…" : "Create account"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-foreground underline underline-offset-4">Sign in</Link>
          </p>
          <p className="text-sm text-muted-foreground text-center mt-4">
            Not sure if FrontDesk AI fits?{" "}
            <Link
              to="/comparison/ai-receptionist-vs-live-chat"
              className="text-foreground underline underline-offset-4"
            >
              AI receptionist vs live chat
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
