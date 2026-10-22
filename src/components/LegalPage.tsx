import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="mb-3 text-sm text-muted-foreground">FrontDesk AI · Effective October 22, 2026</p>
        <h1 className="mb-8 font-serif text-4xl md:text-5xl">{title}</h1>
        <div className="space-y-8 text-base leading-7 text-muted-foreground [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_li]:mb-2 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
        <nav aria-label="Legal policies" className="mt-12 flex flex-wrap gap-6 border-t border-border pt-6 text-sm">
          <Link to="/privacy">Privacy Notice</Link>
          <Link to="/terms">Terms &amp; Conditions</Link>
          <Link to="/refund">Refund Policy</Link>
          <Link to="/contact">Contact FrontDesk AI</Link>
        </nav>
      </main>
    </MarketingShell>
  );
}