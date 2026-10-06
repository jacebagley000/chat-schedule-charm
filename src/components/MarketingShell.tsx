import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-serif text-2xl font-bold italic tracking-tight">
          FrontDesk AI
        </Link>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link to="/features" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Features</Link>
          <Link to="/industries" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Industries</Link>
          <Link to="/pricing" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Pricing</Link>
          <Link to="/signup" className="rounded-full bg-foreground px-5 py-2 font-medium text-background hover:bg-accent">
            Start free trial
          </Link>
        </div>
      </nav>
      {children}
      <section className="border-t border-border bg-secondary py-20 text-center">
        <h2 className="mb-6 font-serif text-4xl">Ready to stop multitasking?</h2>
        <Link to="/signup" className="inline-block rounded-full bg-foreground px-10 py-5 font-medium text-background hover:bg-accent">
          Start your 14-day free trial
        </Link>
      </section>
    </div>
  );
}
