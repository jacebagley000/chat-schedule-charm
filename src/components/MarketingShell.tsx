import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 px-6 py-6 md:flex-row md:items-center">
        <Link to="/" className="shrink-0 font-serif text-2xl font-bold italic">
          FrontDesk AI
        </Link>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 text-sm text-muted-foreground">
          <Link to="/features" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Features</Link>
          <Link to="/industries" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Industries</Link>
          <Link to="/pricing" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Pricing</Link>
          <Link to="/about" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>About</Link>
          <Link to="/contact" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Contact</Link>
          <Link to="/get-started" className="rounded-full bg-foreground px-5 py-2 font-medium text-background hover:bg-accent">
            Get started
          </Link>
        </div>
      </nav>
      {children}
      <section className="border-t border-border bg-secondary py-20 text-center">
        <h2 className="mb-6 font-serif text-4xl">Ready to stop multitasking?</h2>
        <Link to="/get-started" className="inline-block rounded-full bg-foreground px-10 py-5 font-medium text-background hover:bg-accent">
          Create your business account
        </Link>
      </section>
      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 text-sm text-muted-foreground">
          <span>FrontDesk AI</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-6">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/refund" className="hover:text-foreground">Refunds</Link>
            <Link to="/contact" className="hover:text-foreground">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
